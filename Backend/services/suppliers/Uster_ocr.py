"""
Uster_ocr.py
============================================================
Logic-based PDF extractor for Uster Technologies AG.
Supplier ID: 13
"""

import pdfplumber
import re
import io
from datetime import datetime

def safe_float(val):
    if val is None or str(val).strip() == '':
        return 0.0
    clean_val = str(val).strip().replace('$', '').replace('US$', '').replace(',', '').replace(' ', '')
    try:
        return float(clean_val)
    except ValueError:
        return 0.0

def safe_int(val):
    if val is None or str(val).strip() == '':
        return 0
    clean_val = str(val).strip().replace('$', '').replace('US$', '').replace(',', '').replace(' ', '')
    try:
        return int(float(clean_val))
    except ValueError:
        return 0

def Uster_extract(file_bytes: bytes) -> dict:
    pdf_file = io.BytesIO(file_bytes)
    full_text = ""
    
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
            
    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 13,
        "supplier_name": "Uster Technologies AG",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "currency": "CHF",
        "items": []
    }
    
    # 1. Invoice Code (Quotation number S1100008537)
    code_match = re.search(r'Quotation\s*\n\s*([A-Za-z0-9\-]+)', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
        
    # 2. Date (15/Apr/2026)
    date_match = re.search(r'(\d{1,2})/([A-Za-z]+)/(\d{4})', full_text)
    if date_match:
        day = int(date_match.group(1))
        month_str = date_match.group(2).lower()[:3]
        year = int(date_match.group(3))
        months_map = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }
        month = months_map.get(month_str, 1)
        data["date"] = f"{year}-{month:02d}-{day:02d}"
        
    # 3. Payment Method (Payment Terms Letter of credit...)
    payment_match = re.search(r'Payment\s+Terms\s+([^\n\r]+)', full_text, re.IGNORECASE)
    if payment_match:
        data["payment_method"] = payment_match.group(1).strip()
        
    # 4. Currency
    text_upper = full_text.upper()
    if "CHF" in text_upper:
        data["currency"] = "CHF"
    elif "USD" in text_upper or "US$" in text_upper:
        data["currency"] = "USD"
    elif "EUR" in text_upper:
        data["currency"] = "EUR"
        
    # 5. Grand Total (Grand Total CIF Vietnamese Seaport by LCL Incoterms 2020 CHF 201,100.00)
    total_match = re.search(r'Grand\s+Total\s+.*?(?:CHF|USD|EUR|\$)?\s*([\d,]+\.\d{2})', full_text, re.IGNORECASE)
    if total_match:
        data["total_amount_CIF"] = safe_float(total_match.group(1))
        
    # 6. Extract Items
    item_pattern = re.compile(
        r'^\s*(\d+\.\d+)\s+(\S+)\s+([\d,]+\.\d{2})\s+([A-Za-z]+)\s+([\d,]+\.\d{2})\s*$'
    )
    
    lines = full_text.split('\n')
    for idx, line in enumerate(lines):
        m = item_pattern.match(line)
        if m:
            item_no = m.group(1)
            part_no = m.group(2)
            qty = safe_float(m.group(3))
            unit = m.group(4)
            amount = safe_float(m.group(5))
            
            description = ""
            if idx + 1 < len(lines):
                description = lines[idx + 1].strip()
                
            # base price is amount / qty
            base_price = amount
            if qty > 0:
                base_price = amount / qty
                
            item_data = {
                "product_code": part_no,
                "base_price": base_price,
                "quantity": qty,
                "note": description,
                "extra_data": {
                    "Item": item_no,
                    "unit": unit,
                    "amount": amount,
                    "description": description
                }
            }
            data["items"].append(item_data)
            
    return data
