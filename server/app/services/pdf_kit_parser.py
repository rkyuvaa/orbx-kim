import io
import re
from typing import BinaryIO, Dict, List, Optional, Union
import pypdf


def parse_kit_traceability_pdf(file_source: Union[str, bytes, BinaryIO]) -> Dict:
    """
    Parse a stock traceability PDF into structured Kit Master data:
    1. Skip document headers, footers, and column headers.
    2. Extract line 1:
       - Product -> kit_name (e.g. 'X JET 180')
       - Lot/Serial -> kit_number / Kit ID (e.g. 'KIM101020726A100006')
       - To -> customer_name (e.g. 'D PUTTASWAMY')
       - vehicle_number -> empty string (editable title field)
    3. Filter all subsequent rows with a valid Lot/Serial.
    4. Skip duplicates if same serial number exists.
    5. Skip non-serialized rows and extra columns.
    """
    if isinstance(file_source, bytes):
        stream = io.BytesIO(file_source)
        reader = pypdf.PdfReader(stream)
    elif isinstance(file_source, str):
        reader = pypdf.PdfReader(file_source)
    else:
        reader = pypdf.PdfReader(file_source)

    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n"

    discard_lines = {
        "Reference", "Product", "Date", "Lot/Serial #", "From", "To", "Quantity",
        "Konwert India Motors Private Limited", "SF No 237/1B2, Somayampalayam",
        "Near PSBB Millennium School, Vadavalli", "Coimbatore Tamil Nadu 641108 India",
        "GSTIN 33AAHCK7681B1ZL",
    }

    raw_lines = [l.strip() for l in full_text.splitlines() if l.strip()]
    lines = [
        l for l in raw_lines
        if l not in discard_lines and not l.startswith("Traceability Report Reference:")
    ]

    date_regex = re.compile(r"^\d{2}/\d{2}/\d{4}")
    ref_regex = re.compile(r"^(?:KIM/|WH/)")

    records = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if ref_regex.match(line):
            ref = line
            i += 1
            if i < len(lines) and re.match(r"^\d+$", lines[i]):
                ref += lines[i]
                i += 1

            # Accumulate multi-line product name until date line
            product_parts = []
            while i < len(lines) and not date_regex.match(lines[i]):
                product_parts.append(lines[i])
                i += 1
            product = " ".join(product_parts)

            # Date line
            date_str = ""
            if i < len(lines) and date_regex.match(lines[i]):
                date_str = lines[i]
                i += 1
                if i < len(lines) and lines[i].lower() in ("am", "pm"):
                    date_str += " " + lines[i]
                    i += 1

            # Lot/Serial # (if present) vs From location
            lot_serial = None
            if i < len(lines):
                cand = lines[i]
                if (
                    cand.startswith("WH/")
                    or cand == "Production"
                    or cand == "WH/Post-"
                    or cand == "WH/Pre-"
                ):
                    lot_serial = None
                else:
                    lot_serial = cand
                    i += 1

            # From location
            from_loc = ""
            if i < len(lines) and (lines[i].startswith("WH/") or lines[i] == "Production"):
                from_loc = lines[i]
                i += 1
                if i < len(lines) and lines[i] == "Production":
                    from_loc += " " + lines[i]
                    i += 1

            # To location / customer
            to_loc = ""
            if i < len(lines):
                to_loc = lines[i]
                i += 1
                if i < len(lines) and lines[i] in ("Production", "Stock"):
                    to_loc += " " + lines[i]
                    i += 1

            # Quantity
            qty = ""
            if i < len(lines) and re.match(r"^\d+\.\d+", lines[i]):
                qty = lines[i]
                i += 1
                if i < len(lines) and any(lines[i].startswith(u) for u in ["Unit", "Nos", "No", "Set"]):
                    qty += " " + lines[i]
                    i += 1

            records.append({
                "reference": ref,
                "product": product,
                "lot_serial": lot_serial,
                "from": from_loc,
                "to": to_loc,
                "qty": qty,
            })
        else:
            i += 1

    if not records:
        raise ValueError("Could not extract any product records from the provided PDF.")

    first = records[0]
    kit_name = first["product"]
    kit_number = first["lot_serial"] or "UNKNOWN_KIT"
    customer_name = first["to"]

    seen_serials = set()
    seen_serials.add(kit_number)

    components: List[Dict] = []
    code_extract_regex = re.compile(r"^\[([A-Z0-9_-]+)\]", re.IGNORECASE)

    for r in records[1:]:
        sn = r["lot_serial"]
        if not sn:
            continue
        if sn in seen_serials:
            continue
        seen_serials.add(sn)

        product_label = r["product"].strip()
        # Extract component code e.g. "[CHA0201F] Charger Mount Bracket" -> "CHA0201F"
        code_match = code_extract_regex.match(product_label)
        if code_match:
            comp_type = code_match.group(1).upper()
        else:
            # Fallback sanitized type
            comp_type = re.sub(r"[^A-Z0-9_]", "_", product_label.upper())[:40]

        components.append({
            "component_type": comp_type,
            "label": product_label,
            "serial_number": sn,
            "is_required": True,
        })

    total_raw = len(records)
    total_serialized = len(components) + 1  # Including the kit itself
    total_skipped = total_raw - total_serialized

    return {
        "kit_name": kit_name,
        "kit_number": kit_number,
        "customer_name": customer_name,
        "vehicle_number": "",  # Empty title field for user to update as needed
        "components": components,
        "total_raw": total_raw,
        "total_serialized": total_serialized,
        "total_skipped": total_skipped,
    }
