"""
Toyotsu_ocr.py
============================================================
Logic-based PDF extractor for TOYOTSU MACHINERY CORPORATION.
Supplier ID: 10
"""

import pdfplumber
import re
import io
from datetime import datetime

def safe_float(val):
    if val is None:
        return 0.0
    clean_val = str(val).strip().replace('$', '').replace('US$', '').replace(',', '').replace(' ', '')
    try:
        return float(clean_val)
    except ValueError:
        return 0.0

def safe_int(val):
    if val is None:
        return 0
    clean_val = str(val).strip().replace('$', '').replace('US$', '').replace(',', '').replace(' ', '')
    try:
        return int(float(clean_val))
    except ValueError:
        return 0

def is_part_number(token: str) -> bool:
    token = token.strip()
    if '-' not in token:
        return False
    clean_token = token.replace('-', '')
    if not clean_token.isalnum():
        return False
    # Must contain at least 3 digits to avoid false positives with hyphenated words in description
    digit_count = sum(1 for c in clean_token if c.isdigit())
    if digit_count < 3:
        return False
    return True

def Toyotsu_extract(file_bytes: bytes) -> dict:
    """
    Unified extraction logic for Toyotsu PDF quotes/invoices.
    """
    pdf_file = io.BytesIO(file_bytes)
    full_text = ""
    
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"

    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 10,
        "supplier_name": "TOYOTSU MACHINERY CORPORATION",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "currency": "USD",
        "items": []
    }
    
    # 1. Invoice Code
    code_match = re.search(r'(?:No\.?\s*|Invoice\s*No\.?\s*)(VN-\d+(?:\([A-Za-z0-9]+\))?)', full_text, re.IGNORECASE)
    if not code_match:
        code_match = re.search(r'(?:No\.?|Invoice\s*No\.?|Quotation\s*No\.?)\s*[:.]?\s*([A-Z0-9\-]+)', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
        
    # 2. Date
    date_val = None
    date_slash_match = re.search(r'\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b', full_text)
    if date_slash_match:
        y, m, d = date_slash_match.groups()
        date_val = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    else:
        date_match = re.search(r'Date\s*:\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})', full_text, re.IGNORECASE)
        if date_match:
            raw_date = date_match.group(1).strip()
            try:
                clean_date = re.sub(r'\s+', ' ', raw_date)
                dt = datetime.strptime(clean_date, "%b %d, %Y")
                date_val = dt.strftime("%Y-%m-%d")
            except ValueError:
                try:
                    clean_date = re.sub(r'\s+', ' ', raw_date)
                    dt = datetime.strptime(clean_date, "%B %d, %Y")
                    date_val = dt.strftime("%Y-%m-%d")
                except ValueError:
                    date_val = raw_date
    data["date"] = date_val

    # 3. Payment Method
    terms_match = re.search(r'Terms\s+of\s+payment\s*:\s*(.*?)(?=\n\s*(?:Time\s+of\s+shipment|Price\s+Basis|Validity|Our\s+Bank)|$)', full_text, re.IGNORECASE | re.DOTALL)
    if terms_match:
        data["payment_method"] = re.sub(r'\s+', ' ', terms_match.group(1)).strip()

    # 4. Currency
    text_upper = full_text.upper()
    if re.search(r'\bJPY\b|\bYEN\b|¥', text_upper):
        data["currency"] = "JPY"
    elif re.search(r'\bEUR\b|\bEURO\b|€', text_upper):
        data["currency"] = "EUR"
    elif re.search(r'\bUSD\b|U\.S\.?DOLLAR|\$|US\$', text_upper):
        data["currency"] = "USD"

    # 5. CIF Total
    cif_match = re.search(r'CI[FP]\b.*?(?:US\$|\$|JPY|EUR)?\s*([\d,]+(?:\.\d+)?)', full_text, re.IGNORECASE)
    if cif_match:
        data["total_amount_CIF"] = safe_float(cif_match.group(1))

    # 6. Items
    item_pattern = re.compile(
        r'^\s*(\d+)\s+([A-Za-z0-9\-]+)\s+(.*?)\s+([\d,]+)\s+([A-Za-z]+)\s+(?:US\$|\$|JPY|EUR)?\s*([\d,]+(?:\.\d+)?)\s+(?:US\$|\$|JPY|EUR)?\s*([\d,]+(?:\.\d+)?)\s*$',
        re.IGNORECASE
    )

    for line in full_text.split('\n'):
        m = item_pattern.match(line)
        if m:
            item_no = safe_int(m.group(1))
            inquiry_parts_no = m.group(2).strip()
            desc_part = m.group(3).strip()
            qty = safe_int(m.group(4))
            unit = m.group(5).strip()
            base_price = safe_float(m.group(6))
            amount = safe_float(m.group(7))
            
            # Split desc_part by whitespace to find Parts No.(Latest) if any
            tokens = desc_part.split()
            parts_no_latest = None
            description = desc_part
            
            if tokens:
                first_token = tokens[0]
                if is_part_number(first_token):
                    parts_no_latest = first_token
                    description = " ".join(tokens[1:])
                    
            product_code = parts_no_latest if parts_no_latest else inquiry_parts_no
            
            item_data = {
                "product_code": product_code,
                "base_price": base_price,
                "quantity": qty,
                "note": description,
                "extra_data": {
                    "Item": item_no,
                    "Inquiry Parts No.": inquiry_parts_no,
                    "Parts No.(Latest)": parts_no_latest if parts_no_latest else "",
                    "Description": description,
                    "Unit": unit,
                    "Amount": amount
                }
            }
            data["items"].append(item_data)
            
    return data
