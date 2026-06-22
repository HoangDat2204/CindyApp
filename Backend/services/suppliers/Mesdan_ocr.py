"""
Mesdan_ocr.py
============================================================
Logic-based PDF extractor for Mesdan (Mesdan S.p.A.).
Supplier ID: 6
"""

import pdfplumber
import re
import io

def safe_float(val):
    if val is None or str(val).strip() == '': 
        return None
    # Clean European number formatting (dot for thousands, comma for decimal)
    clean_val = str(val).strip().replace('.', '').replace(',', '.')
    match = re.search(r'[-+]?\d*\.?\d+', clean_val)
    if match:
        try:
            return float(match.group(0))
        except ValueError:
            return None
    return None

def safe_int(val):
    if val is None or str(val).strip() == '': 
        return None
    clean_val = str(val).strip().replace('.', '').replace(',', '.')
    match = re.search(r'[-+]?\d*\.?\d+', clean_val)
    if match:
        try:
            return int(float(match.group(0)))
        except ValueError:
            return None
    return None

def Mesdan_extract(file_bytes: bytes) -> dict:
    pdf_file = io.BytesIO(file_bytes)
    full_text = ""
    
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
            
    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 6,
        "supplier_name": "Mesdan S.p.A.",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "items": []
    }
    
    # 1. Parse Quotation Number (invoice_code)
    # Pattern: Proforma Invoice No 219202 or Ref: LL/ER 219202
    code_match = re.search(r'(?:Proforma\s*Invoice|Ref.*?)\s*(?:No\.?)?\s*(\d{6})', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
    else:
        # Fallback search for any 6-digit number in first few lines
        fallback_match = re.search(r'\b\d{6}\b', full_text[:1000])
        if fallback_match:
            data["invoice_code"] = fallback_match.group(0)
        
    # 2. Parse Date
    # Pattern: Date: 08/09/2025
    date_match = re.search(r'Date\s*[：:]\s*(\d{2})[/-](\d{2})[/-](\d{4})', full_text, re.IGNORECASE)
    if date_match:
        d = date_match.group(1).zfill(2)
        m = date_match.group(2).zfill(2)
        y = date_match.group(3)
        data["date"] = f"{y}-{m}-{d}"
        
    # 3. Parse Payment Method
    # Pattern: Payment terms: IRREVOCABLE LETTER OF CREDIT AT SIGHT
    pay_match = re.search(r'(?:Payment\s*terms|Payment)\s*[：:]\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if pay_match:
        data["payment_method"] = pay_match.group(1).strip()

    # 4. Parse Items from text
    lines = full_text.split('\n')
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if "Code Description Qty" in line:
            start_idx = i
        if "TOTAL" in line and start_idx != -1 and end_idx == -1:
            end_idx = i
            break

    item_regex = r'^(\d{3,4}(?:\s+\d{3,4})?[A-Z]*)\s+(.*?)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})'
    current_item = None

    if start_idx != -1 and end_idx != -1:
        for idx in range(start_idx + 1, end_idx):
            line = lines[idx].strip()
            if not line:
                continue
            
            # Check for header/total boundaries to stop appending notes
            line_upper = line.upper()
            if any(x in line_upper for x in ["OPTIONAL ACCESSORIES", "PACKING CHARGES", "TOTAL"]):
                current_item = None
                continue
            
            # Check priced item match
            match = re.match(item_regex, line)
            if match:
                code = match.group(1).strip()
                desc = match.group(2).strip()
                qty = int(match.group(3))
                rate = safe_float(match.group(4))
                if rate is None:
                    rate = 0.0
                total_p = qty * rate
                
                current_item = {
                    "product_code": code,
                    "note": desc,
                    "quantity": qty,
                    "base_price": rate,
                    "extra_data": {
                        "Description": desc,
                        "Unit Price": rate,
                        "Total Price": total_p
                    }
                }
                data["items"].append(current_item)
            else:
                # Check non-priced item match (e.g. Phytosanitary certificate 1)
                non_priced_match = re.match(r'^(\d{3,4}(?:\s+[A-Z\d]+)?)\s+(.*?)\s+(\d+)$', line)
                if non_priced_match:
                    code = non_priced_match.group(1).strip()
                    desc = non_priced_match.group(2).strip()
                    qty = int(non_priced_match.group(3))
                    rate = 0.0
                    total_p = 0.0
                    
                    current_item = {
                        "product_code": code,
                        "note": desc,
                        "quantity": qty,
                        "base_price": rate,
                        "extra_data": {
                            "Description": desc,
                            "Unit Price": rate,
                            "Total Price": total_p
                        }
                    }
                    data["items"].append(current_item)
                elif current_item:
                    # Append description wraps
                    current_item["note"] += " " + line
                    current_item["extra_data"]["Description"] += " " + line

    # 5. Parse Total Amount CIF
    # Pattern: Total Value CIF Ho Chi Minh port 77.781,00
    cif_match = re.search(r'(?:Total\s*Value\s*CIF|CIF)\s*[^0-9]*([\d.]+,\d{2})', full_text, re.IGNORECASE)
    if cif_match:
        data["total_amount_CIF"] = safe_float(cif_match.group(1))
    else:
        # Fallback to sum of items + packing charges
        total = 0.0
        for item in data["items"]:
            total += (item["quantity"] or 0) * (item["base_price"] or 0.0)
        # Add optional packing charges if found
        pack_match = re.search(r'Packing\s*charges\s*([\d.]+,\d{2})', full_text, re.IGNORECASE)
        if pack_match:
            total += safe_float(pack_match.group(1)) or 0.0
        data["total_amount_CIF"] = total
        
    return data
