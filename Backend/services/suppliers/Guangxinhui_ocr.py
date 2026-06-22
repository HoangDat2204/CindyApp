"""
Guangxinhui_ocr.py
============================================================
Logic-based PDF extractor for GUANGXINHUI COMPANY LIMITED.
Supplier ID: 11
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

def clean_commodity(commodity_str: str) -> str:
    if not commodity_str:
        return ""
    cleaned = commodity_str.replace('\n', ' ')
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()

def extract_product_code(model_str: str) -> str:
    if not model_str:
        return ""
    parts_nl = model_str.split('\n')
    first_part = parts_nl[0].strip()
    first_part = re.split(r'[\(\)（）]', first_part)[0].strip()
    return first_part

def Guangxinhui_extract(file_bytes: bytes) -> dict:
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
        "supplier_id": 11,
        "supplier_name": "GUANGXINHUI COMPANY LIMITED",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "currency": "USD",
        "items": []
    }
    
    # 1. Invoice Code (Ref: GXH2604223R3)
    code_match = re.search(r'Ref\s*:\s*([A-Za-z0-9\-]+)', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
        
    # 2. Date
    date_match = re.search(r'Date\s*:\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})', full_text, re.IGNORECASE)
    if date_match:
        raw_date = date_match.group(1).strip()
        for fmt in ("%B %d, %Y", "%b %d, %Y"):
            try:
                dt = datetime.strptime(raw_date, fmt)
                data["date"] = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue
                
    # 3. Payment Method
    payment_match = re.search(r'Payment\s*:\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if payment_match:
        data["payment_method"] = payment_match.group(1).strip()
        
    # 4. Total CIF
    for table in tables:
        if not table:
            continue
        for row in table:
            if not row:
                continue
            row_str = " ".join([str(x).upper() for x in row if x])
            if "合计" in row_str or "TOTAL AMOUNT" in row_str:
                for cell in reversed(row):
                    if cell:
                        val = safe_float(cell)
                        if val > 0:
                            data["total_amount_CIF"] = val
                            break
                            
    if not data["total_amount_CIF"]:
        cif_match = re.search(r'CIF\s+.*?\s+([\d,]+\.\d{2})', full_text, re.IGNORECASE)
        if cif_match:
            data["total_amount_CIF"] = safe_float(cif_match.group(1))
            
    # 5. Extract items
    for table in tables:
        if not table or len(table) < 2:
            continue
            
        header_idx = -1
        col_map = {}
        for idx, row in enumerate(table):
            if not row:
                continue
            row_str = " ".join([str(x).upper() for x in row if x])
            if ("COMMODITY" in row_str or "设备名称" in row_str) and ("MODEL" in row_str or "规格" in row_str):
                header_idx = idx
                for c_idx, h in enumerate(row):
                    if not h:
                        continue
                    h_upper = str(h).upper()
                    if "COMMODITY" in h_upper or "设备名称" in h_upper:
                        col_map["commodity"] = c_idx
                    elif "MODEL" in h_upper or "规格" in h_upper:
                        col_map["model"] = c_idx
                    elif "UNIT PRICE" in h_upper or "单价" in h_upper:
                        col_map["unit_price"] = c_idx
                    elif "QTY" in h_upper or "数量" in h_upper:
                        col_map["qty"] = c_idx
                    elif "AMOUNT" in h_upper or "总价" in h_upper:
                        col_map["amount"] = c_idx
                break
                
        if header_idx != -1:
            for r_idx in range(header_idx + 1, len(table)):
                row = table[r_idx]
                if not row or all(x is None or str(x).strip() == "" for x in row):
                    continue
                    
                first_cell = str(row[0] or '').strip().upper()
                if "合计" in first_cell or "TOTAL AMOUNT" in first_cell:
                    continue
                
                commodity_idx = col_map.get("commodity")
                model_idx = col_map.get("model")
                qty_idx = col_map.get("qty")
                price_idx = col_map.get("unit_price")
                amount_idx = col_map.get("amount")
                
                commodity_val = str(row[commodity_idx] or '').strip() if commodity_idx is not None else ''
                model_val = str(row[model_idx] or '').strip() if model_idx is not None else ''
                
                if not commodity_val and not model_val:
                    continue
                    
                if "合计" in commodity_val.upper() or "TOTAL AMOUNT" in commodity_val.upper():
                    continue
                    
                qty_val = safe_int(row[qty_idx]) if qty_idx is not None else 0
                price_val = safe_float(row[price_idx]) if price_idx is not None else 0.0
                amount_val = safe_float(row[amount_idx]) if amount_idx is not None else 0.0
                
                product_code = extract_product_code(model_val)
                if not product_code:
                    product_code = extract_product_code(commodity_val)
                    
                note_val = clean_commodity(commodity_val)
                
                item_data = {
                    "product_code": product_code,
                    "base_price": price_val,
                    "quantity": qty_val,
                    "note": note_val,
                    "extra_data": {
                        "specification": model_val.replace('\n', ' '),
                        "commodity": commodity_val.replace('\n', ' '),
                        "amount": amount_val
                    }
                }
                data["items"].append(item_data)
                
    return data
