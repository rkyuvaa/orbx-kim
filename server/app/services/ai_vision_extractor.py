import base64
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
    """Strip markdown code blocks and whitespace."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
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
        clean_mime = mime_type.lower()
        if clean_mime not in ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]:
            clean_mime = "image/jpeg"

        provider = (provider_type or "GOOGLE").upper()

        try:
            if provider == "GOOGLE":
                return await AIVisionExtractor._extract_google(
                    b64_data, clean_mime, model_name, api_key, api_endpoint
                )
            elif provider in ("NVIDIA", "OPENROUTER", "KILO"):
                return await AIVisionExtractor._extract_openai_compatible(
                    b64_data, clean_mime, provider, model_name, api_key, api_endpoint
                )
            elif provider == "LOCAL":
                return await AIVisionExtractor._extract_local_ollama(
                    b64_data, clean_mime, model_name, api_endpoint
                )
            else:
                return await AIVisionExtractor._extract_google(
                    b64_data, clean_mime, model_name, api_key, api_endpoint
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
    ) -> ExtractedBillData:
        key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
        if not key:
            logger.warning("No Google API Key provided. Returning fallback extraction.")
            return ExtractedBillData(
                status="NEEDS_REVIEW",
                confidence=0.0,
                error_message="Google API Key not configured in environment or settings.",
            )

        model = model_name or "gemini-1.5-flash"
        endpoint = api_endpoint or f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        url = f"{endpoint}?key={key}"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": EXTRACTION_PROMPT},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json",
            },
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Google Gemini API error {resp.status_code}: {resp.text}")

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return ExtractedBillData(status="FAILED", error_message="Empty response from Gemini")

            part_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
            return AIVisionExtractor._parse_json_result(part_text, data)

    @staticmethod
    async def _extract_openai_compatible(
        b64_data: str,
        mime_type: str,
        provider: str,
        model_name: str,
        api_key: Optional[str],
        api_endpoint: Optional[str],
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
        key = api_key or default_keys.get(provider, "")

        if not key:
            return ExtractedBillData(
                status="NEEDS_REVIEW",
                confidence=0.0,
                error_message=f"{provider} API Key not configured.",
            )

        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

        data_url = f"data:{mime_type};base64,{b64_data}"
        payload = {
            "model": model_name or ("meta/llama-3.2-11b-vision-instruct" if provider == "NVIDIA" else "google/gemini-flash-1.5"),
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": EXTRACTION_PROMPT},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
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
