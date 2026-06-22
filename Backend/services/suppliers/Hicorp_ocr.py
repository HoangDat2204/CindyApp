"""
Hicorp_ocr.py
============================================================
Logic-based PDF extractor for HICORP MACHINERY (QINGDAO) CO., LTD.
Supplier ID: 12
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

def Hicorp_extract(file_bytes: bytes) -> dict:
    pdf_file = io.BytesIO(file_bytes)
    full_text = ""
    tables = []
    
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
            tables.extend(page.extract_tables())
            
    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 12,
        "supplier_name": "HICORP MACHINERY (QINGDAO) CO., LTD",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "currency": "USD",
        "items": []
    }
    
    # 1. Invoice Code (INVOICENO.:HM-TT260507R1)
    code_match = re.search(r'INVOICENO\s*\.?\s*:\s*([A-Za-z0-9\-]+)', full_text, re.IGNORECASE)
    if not code_match:
        code_match = re.search(r'INVOICE\s*NO\s*\.?\s*:\s*([A-Za-z0-9\-]+)', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
        
    # 2. Date (DATED:14MAY,2026)
    date_match = re.search(r'DATED\s*:\s*(\d{1,2})\s*([A-Za-z]+)\s*,\s*(\d{4})', full_text, re.IGNORECASE)
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
        
    # 3. Payment Method (Terms of Payment: T/T)
    payment_match = re.search(r'Terms\s+of\s+Payment\s*:\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if not payment_match:
        payment_match = re.search(r'Payment\s*:\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if payment_match:
        data["payment_method"] = payment_match.group(1).strip()
        
    # 4. Currency identification
    text_upper = full_text.upper()
    if "JPY" in text_upper or "¥" in text_upper:
        data["currency"] = "JPY"
    elif "EUR" in text_upper or "€" in text_upper:
        data["currency"] = "EUR"
    else:
        data["currency"] = "USD"
        
    # 5. Extract Total CIF/CFR
    for table in tables:
        if not table:
            continue
        for row in table:
            if not row:
                continue
            row_str = " ".join([str(x).upper() for x in row if x])
            if "TOTAL" in row_str:
                for cell in reversed(row):
                    if cell:
                        val = safe_float(cell)
                        if val > 0:
                            data["total_amount_CIF"] = val
                            break
                            
    if not data["total_amount_CIF"]:
        # Fallback to Regex total extraction
        total_match = re.search(r'Total.*?\s+([\d,]+\.?\d*)', full_text, re.IGNORECASE)
        if total_match:
            data["total_amount_CIF"] = safe_float(total_match.group(1))
            
    # 6. Extract Items
    for table in tables:
        if not table or len(table) < 1:
            continue
        for row in table:
            if not row or len(row) < 7:
                continue
                
            first_cell = str(row[0] or '').strip()
            if first_cell.isdigit():
                item_no = int(first_cell)
                description = str(row[1] or '').strip().replace('\n', ' ')
                specification = str(row[3] or '').strip().replace('\n', ' ')
                qty = safe_int(row[4])
                unit_price = safe_float(row[5])
                amount = safe_float(row[6])
                
                # Clean multiple whitespaces
                description = re.sub(r'\s+', ' ', description)
                specification = re.sub(r'\s+', ' ', specification)
                
                # Product code is from specification
                product_code = specification
                # Note is description (English name only, no Chinese)
                note = description
                
                item_data = {
                    "product_code": product_code,
                    "base_price": unit_price,
                    "quantity": qty,
                    "note": note,
                    "extra_data": {
                        "Item": item_no,
                        "description": description,
                        "specification": specification,
                        "amount": amount
                    }
                }
                data["items"].append(item_data)
                
    return data
