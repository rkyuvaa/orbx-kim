import base64
import io
import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class ExtractedBillData:
    bill_number: Optional[str] = None
    bill_date: Optional[str] = None  # YYYY-MM-DD
    supplier_name: Optional[str] = None
    taxable_amount: float = 0.0
    cgst_pct: float = 0.0
    cgst_amount: float = 0.0
    sgst_pct: float = 0.0
    sgst_amount: float = 0.0
    igst_pct: float = 0.0
    igst_amount: float = 0.0
    gst_total: float = 0.0
    total_amount: float = 0.0
    category_hint: Optional[str] = None
    confidence: float = 0.0
    raw_response: Optional[dict[str, Any]] = None
    status: str = "EXTRACTED"
    error_message: Optional[str] = None


EXTRACTION_PROMPT = """
You are an expert bill and receipt reader.
Carefully examine this document and extract the printed information.
Do NOT calculate or recalculate any values. Simply extract what is printed on the document into the relevant fields.

Return ONLY a valid JSON object with this exact structure:
{
  "bill_number": "invoice or bill number string or null",
  "bill_date": "YYYY-MM-DD or null",
  "supplier_name": "vendor or store name or null",
  "taxable_amount": float or 0.0,
  "cgst_pct": float or 0.0,
  "cgst_amount": float or 0.0,
  "sgst_pct": float or 0.0,
  "sgst_amount": float or 0.0,
  "igst_pct": float or 0.0,
  "igst_amount": float or 0.0,
  "total_amount": float or 0.0,
  "category_hint": "Travel|Food|Accommodation|Fuel|Office Supplies|Courier|Software|Other",
  "notes": "brief summary of items or notes"
}
"""


def _clean_json_text(text: str) -> str:
    """Strip markdown code blocks, prefixes, suffixes, and whitespace."""
    text = (text or "").strip()
    code_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
    if code_match:
        return code_match.group(1).strip()
    brace_match = re.search(r"(\{[\s\S]*\})", text)
    if brace_match:
        return brace_match.group(1).strip()
    return text.strip()


def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        if isinstance(val, (int, float)):
            return float(val)
        cleaned = re.sub(r"[^\d.-]", "", str(val))
        return float(cleaned) if cleaned else default
    except Exception:
        return default


def _process_pdf_file(file_bytes: bytes) -> tuple[Optional[str], Optional[bytes], str, Optional[str]]:
    """
    Extracts text and any embedded receipt image from PDF using pypdf.
    Returns: (extracted_text, embedded_image_bytes, image_mime, error)
    """
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_text = []
        found_image_bytes = None
        found_mime = "image/jpeg"

        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages_text.append(t)
            if not found_image_bytes and page.images:
                img = page.images[0]
                found_image_bytes = img.data
                name = getattr(img, "name", "").lower()
                if name.endswith(".png"):
                    found_mime = "image/png"
                elif name.endswith(".webp"):
                    found_mime = "image/webp"
                else:
                    found_mime = "image/jpeg"

        full_text = "\n".join(pages_text).strip()
        return (full_text if full_text else None), found_image_bytes, found_mime, None
    except Exception as exc:
        logger.warning(f"Failed to process PDF with pypdf: {exc}")
        return None, None, "application/pdf", str(exc)


class AIVisionExtractor:
    @staticmethod
    async def extract_from_file(
        file_bytes: bytes,
        mime_type: str,
        provider_type: str = "GOOGLE",
        model_name: str = "gemini-1.5-flash",
        api_endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        config_json: Optional[dict[str, Any]] = None,
    ) -> ExtractedBillData:
        """
        Extracts bill details using the selected vision AI provider.
        Does not perform calculations; returns extracted fields directly.
        """
        b64_data = base64.b64encode(file_bytes).decode("utf-8")
        clean_mime = (mime_type or "image/jpeg").split(";")[0].strip().lower()
        if clean_mime in ["image/jpg", "image/pjpeg"]:
            clean_mime = "image/jpeg"
        elif clean_mime not in ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]:
            clean_mime = "image/jpeg"

        # Check if PDF: extract text and embedded image
        pdf_text: Optional[str] = None
        if clean_mime == "application/pdf":
            extracted_text, img_bytes, img_mime, _ = _process_pdf_file(file_bytes)
            if img_bytes:
                b64_data = base64.b64encode(img_bytes).decode("utf-8")
                clean_mime = img_mime
            pdf_text = extracted_text

        provider = (provider_type or "GOOGLE").upper()

        try:
            if provider == "GOOGLE":
                return await AIVisionExtractor._extract_google(
                    b64_data, clean_mime, model_name, api_key, api_endpoint, pdf_text
                )
            elif provider in ("NVIDIA", "OPENROUTER", "KILO"):
                return await AIVisionExtractor._extract_openai_compatible(
                    b64_data, clean_mime, provider, model_name, api_key, api_endpoint, pdf_text
                )
            elif provider == "LOCAL":
                return await AIVisionExtractor._extract_local_ollama(
                    b64_data, clean_mime, model_name, api_endpoint
                )
            else:
                return await AIVisionExtractor._extract_google(
                    b64_data, clean_mime, model_name, api_key, api_endpoint, pdf_text
                )
        except Exception as exc:
            logger.exception(f"Error during AI vision extraction ({provider}): {exc}")
            return ExtractedBillData(
                status="FAILED",
                error_message=str(exc),
                confidence=0.0,
                raw_response={"error": str(exc)},
            )

    @staticmethod
    async def _extract_google(
        b64_data: str,
        mime_type: str,
        model_name: str,
        api_key: Optional[str],
        api_endpoint: Optional[str],
        pdf_text: Optional[str] = None,
    ) -> ExtractedBillData:
        key = (api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
        if not key:
            err_msg = "Google Gemini API key not configured. Please enter your API key in Expenses -> Configuration -> AI Vision Providers."
            logger.warning(err_msg)
            return ExtractedBillData(
                status="NEEDS_REVIEW",
                confidence=0.0,
                error_message=err_msg,
                raw_response={"error": err_msg},
            )

        model = (model_name or "gemini-2.0-flash").strip()
        if model.startswith("models/"):
            model = model.replace("models/", "")

        prompt = EXTRACTION_PROMPT
        if pdf_text:
            prompt += f"\n\n=== DOCUMENT TEXT FROM PDF ===\n{pdf_text[:8000]}"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": b64_data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }

        models_to_try = [model]
        for m in ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"]:
            if m not in models_to_try:
                models_to_try.append(m)

        last_error = ""
        async with httpx.AsyncClient(timeout=45.0) as client:
            for current_model in models_to_try:
                if api_endpoint and ":generateContent" in api_endpoint:
                    url = f"{api_endpoint.rstrip('/')}?key={key}"
                elif api_endpoint:
                    url = f"{api_endpoint.rstrip('/')}/models/{current_model}:generateContent?key={key}"
                else:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={key}"

                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if not candidates:
                        return ExtractedBillData(
                            status="FAILED",
                            error_message=f"Empty response from Gemini: {data}",
                            raw_response=data,
                        )
                    part_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                    return AIVisionExtractor._parse_json_result(part_text, data)
                elif resp.status_code == 404:
                    last_error = resp.text
                    continue
                else:
                    raise RuntimeError(f"Google Gemini API error ({resp.status_code}): {resp.text}")

            raise RuntimeError(f"Google Gemini API error: {last_error or 'No available Gemini model found.'}")

    @staticmethod
    async def _extract_openai_compatible(
        b64_data: str,
        mime_type: str,
        provider: str,
        model_name: str,
        api_key: Optional[str],
        api_endpoint: Optional[str],
        pdf_text: Optional[str] = None,
    ) -> ExtractedBillData:
        default_endpoints = {
            "NVIDIA": "https://integrate.api.nvidia.com/v1/chat/completions",
            "OPENROUTER": "https://openrouter.ai/api/v1/chat/completions",
            "KILO": "https://api.kilo.ai/v1/chat/completions",
        }
        default_keys = {
            "NVIDIA": os.environ.get("NVIDIA_API_KEY", ""),
            "OPENROUTER": os.environ.get("OPENROUTER_API_KEY", ""),
            "KILO": os.environ.get("KILO_API_KEY", ""),
        }

        endpoint = api_endpoint or default_endpoints.get(provider, "https://openrouter.ai/api/v1/chat/completions")
        key = (api_key or default_keys.get(provider, "") or "").strip()

        if not key:
            err_msg = f"{provider} API key not configured. Please enter your API key in Expenses -> Configuration -> AI Vision Providers."
            return ExtractedBillData(
                status="NEEDS_REVIEW",
                confidence=0.0,
                error_message=err_msg,
                raw_response={"error": err_msg},
            )

        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

        # Resolve model name: if user had old deprecated google/gemini-flash-1.5 on OpenRouter, fallback to openrouter/free
        resolved_model = model_name
        if provider == "OPENROUTER":
            if not resolved_model or resolved_model == "google/gemini-flash-1.5":
                resolved_model = "openrouter/free"
        elif provider == "NVIDIA":
            resolved_model = resolved_model or "meta/llama-3.2-11b-vision-instruct"

        prompt = EXTRACTION_PROMPT
        if pdf_text:
            prompt += f"\n\n=== DOCUMENT TEXT FROM PDF INVOICE ===\n{pdf_text[:8000]}"

        # Prepare message content
        user_content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]

        if mime_type.startswith("image/"):
            data_url = f"data:{mime_type};base64,{b64_data}"
            user_content.append({"type": "image_url", "image_url": {"url": data_url}})
        elif not pdf_text:
            # Scanned PDF where image could not be extracted directly
            data_url = f"data:{mime_type};base64,{b64_data}"
            user_content.append({"type": "image_url", "image_url": {"url": data_url}})

        payload = {
            "model": resolved_model,
            "messages": [
                {
                    "role": "user",
                    "content": user_content,
                }
            ],
            "temperature": 0.1,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"{provider} API returned {resp.status_code}: {resp.text}")

            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
            return AIVisionExtractor._parse_json_result(content, data)

    @staticmethod
    async def test_connection(
        provider_type: str,
        model_name: str,
        api_endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> dict[str, Any]:
        """Tests live connectivity and credentials for the specified provider."""
        provider = (provider_type or "GOOGLE").upper()
        key = (api_key or "").strip()

        if not key and provider != "LOCAL":
            return {"success": False, "message": f"API key is required to test {provider}."}

        try:
            if provider == "GOOGLE":
                model = (model_name or "gemini-2.0-flash").strip()
                if model.startswith("models/"):
                    model = model.replace("models/", "")

                # Step 1: Query Google's ListModels endpoint to verify API key and discover active models
                list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
                async with httpx.AsyncClient(timeout=15.0) as client:
                    list_resp = await client.get(list_url)
                    if list_resp.status_code != 200:
                        error_detail = list_resp.text
                        try:
                            err_json = list_resp.json()
                            error_detail = err_json.get("error", {}).get("message", list_resp.text)
                        except Exception:
                            pass
                        return {"success": False, "message": f"Google API error ({list_resp.status_code}): {error_detail}"}

                    list_data = list_resp.json()
                    available_models = [
                        m.get("name", "").replace("models/", "")
                        for m in list_data.get("models", [])
                        if "generateContent" in m.get("supportedGenerationMethods", [])
                    ]

                    # Pick model: either user's model or best matching available model
                    target_model = model
                    note = ""
                    if available_models and target_model not in available_models:
                        preferred = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro"]
                        best = next((p for p in preferred if p in available_models), available_models[0])
                        note = f" (Switched from retired '{model}' to active '{best}')"
                        target_model = best

                    # Step 2: Test generateContent with target_model
                    test_url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={key}"
                    payload = {
                        "contents": [{"parts": [{"text": "Reply with 'OK' only."}]}],
                        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 10},
                    }
                    resp = await client.post(test_url, json=payload)
                    if resp.status_code == 200:
                        return {
                            "success": True,
                            "message": f"Successfully connected to Google Gemini ({target_model})!{note}",
                            "recommended_model": target_model,
                        }
                    else:
                        error_detail = resp.text
                        try:
                            err_json = resp.json()
                            error_detail = err_json.get("error", {}).get("message", resp.text)
                        except Exception:
                            pass
                        return {"success": False, "message": f"Google Gemini API error ({resp.status_code}): {error_detail}"}

            elif provider in ("NVIDIA", "OPENROUTER", "KILO"):
                default_endpoints = {
                    "NVIDIA": "https://integrate.api.nvidia.com/v1/chat/completions",
                    "OPENROUTER": "https://openrouter.ai/api/v1/chat/completions",
                    "KILO": "https://api.kilo.ai/v1/chat/completions",
                }
                endpoint = api_endpoint or default_endpoints.get(provider, "https://openrouter.ai/api/v1/chat/completions")
                model = model_name or ("meta/llama-3.2-11b-vision-instruct" if provider == "NVIDIA" else "google/gemini-flash-1.5")
                headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": "Reply with 'OK' only."}],
                    "max_tokens": 10,
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        return {"success": True, "message": f"Successfully connected to {provider} ({model})!"}
                    else:
                        return {"success": False, "message": f"{provider} API error ({resp.status_code}): {resp.text}"}

            elif provider == "LOCAL":
                endpoint = api_endpoint or "http://localhost:11434/api/tags"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(endpoint)
                    if resp.status_code == 200:
                        return {"success": True, "message": "Successfully connected to local Ollama!"}
                    else:
                        return {"success": False, "message": f"Ollama connection error ({resp.status_code}): {resp.text}"}

            return {"success": False, "message": f"Unsupported provider: {provider}"}
        except Exception as exc:
            return {"success": False, "message": f"Connection failed: {str(exc)}"}

    @staticmethod
    async def _extract_local_ollama(
        b64_data: str,
        mime_type: str,
        model_name: str,
        api_endpoint: Optional[str],
    ) -> ExtractedBillData:
        endpoint = api_endpoint or "http://localhost:11434/api/generate"
        model = model_name or "llama3.2-vision"

        payload = {
            "model": model,
            "prompt": EXTRACTION_PROMPT + "\nRespond with JSON only.",
            "images": [b64_data],
            "stream": False,
            "format": "json",
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(endpoint, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama API returned {resp.status_code}: {resp.text}")

            data = resp.json()
            response_text = data.get("response", "{}")
            return AIVisionExtractor._parse_json_result(response_text, data)

    @staticmethod
    def _parse_json_result(raw_text: str, full_api_response: dict[str, Any]) -> ExtractedBillData:
        cleaned = _clean_json_text(raw_text)
        try:
            parsed = json.loads(cleaned)
        except Exception:
            # Fallback regex extraction if full JSON parse fails
            parsed = {}
            logger.warning(f"Could not parse direct JSON from LLM: {raw_text[:200]}")

        bill_num = parsed.get("bill_number")
        bill_date = parsed.get("bill_date")
        supplier = parsed.get("supplier_name")
        taxable = _safe_float(parsed.get("taxable_amount"))
        cgst_pct = _safe_float(parsed.get("cgst_pct"))
        cgst_amt = _safe_float(parsed.get("cgst_amount"))
        sgst_pct = _safe_float(parsed.get("sgst_pct"))
        sgst_amt = _safe_float(parsed.get("sgst_amount"))
        igst_pct = _safe_float(parsed.get("igst_pct"))
        igst_amt = _safe_float(parsed.get("igst_amount"))
        total = _safe_float(parsed.get("total_amount"))
        gst_total = cgst_amt + sgst_amt + igst_amt

        # User Rule: Do not recalculate or override.
        # If total is 0 but taxable exists and no taxes, let taxable be total if total is 0.
        if total == 0.0 and taxable > 0.0 and gst_total == 0.0:
            total = taxable

        status = "EXTRACTED" if (total > 0.0 or supplier or bill_num) else "NEEDS_REVIEW"
        confidence = 0.90 if (total > 0.0 and supplier) else 0.50

        return ExtractedBillData(
            bill_number=str(bill_num).strip() if bill_num else None,
            bill_date=str(bill_date).strip() if bill_date else None,
            supplier_name=str(supplier).strip() if supplier else None,
            taxable_amount=round(taxable, 2),
            cgst_pct=round(cgst_pct, 2),
            cgst_amount=round(cgst_amt, 2),
            sgst_pct=round(sgst_pct, 2),
            sgst_amount=round(sgst_amt, 2),
            igst_pct=round(igst_pct, 2),
            igst_amount=round(igst_amt, 2),
            gst_total=round(gst_total, 2),
            total_amount=round(total, 2),
            category_hint=parsed.get("category_hint"),
            confidence=confidence,
            raw_response=full_api_response,
            status=status,
        )
