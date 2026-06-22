"""
KaiGong_ocr.py
============================================================
Logic-based PDF extractor for Jiangsu Kaigong Machinery (JIANGSU KAIGONG MACHINERY CO., LTD.).
Supplier ID: 5
"""

import pdfplumber
import re
import io

def safe_float(val):
    if val is None or str(val).strip() == '': 
        return None
    match = re.search(r'[-+]?\d*\.?\d+', str(val).replace(',', ''))
    if match:
        try:
            return float(match.group(0))
        except ValueError:
            return None
    return None

def safe_int(val):
    if val is None or str(val).strip() == '': 
        return None
    match = re.search(r'[-+]?\d*\.?\d+', str(val).replace(',', ''))
    if match:
        try:
            return int(float(match.group(0)))
        except ValueError:
            return None
    return None

def KaiGong_extract(file_bytes: bytes) -> dict:
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
        "supplier_id": 5,
        "supplier_name": "JIANGSU KAIGONG MACHINERY CO., LTD.",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "items": []
    }
    
    # 1. Parse Quotation Number (invoice_code)
    # Pattern: Quotation No. : Rev.1-ZJBJ0295 or similar
    code_match = re.search(r'Rev\.\d+-[A-Z0-9]+', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(0).strip()
        
    # 2. Parse Date
    # Pattern: Issuing Date: 2026/5/18 or similar
    date_match = re.search(r'(?:Issuing\s*)?Date\s*:\s*(\d{4})[/-](\d{1,2})[/-](\d{1,2})', full_text, re.IGNORECASE)
    if date_match:
        y = date_match.group(1)
        m = date_match.group(2).zfill(2)
        d = date_match.group(3).zfill(2)
        data["date"] = f"{y}-{m}-{d}"
        
    # 3. Parse Payment Method
    # Pattern: Payment conditions: 100% irrevocable L/C at sight or similar
    pay_match = re.search(r'(?:Payment\s*conditions|付款条件)\s*[：:]\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if pay_match:
        data["payment_method"] = pay_match.group(1).strip()
    else:
        # Fallback keyword checks
        if "LETTER OF CREDIT" in full_text.upper() or "L/C" in full_text.upper():
            data["payment_method"] = "L/C at sight"
        elif "T/T" in full_text.upper():
            data["payment_method"] = "T/T"

    # 4. Parse Items from tables
    for table in tables:
        if not table or len(table) < 2:
            continue
            
        # Check if table is the main quotation table (has NAME and MODEL and UNIT PRICE headers)
        header_idx = -1
        for idx, row in enumerate(table):
            row_str = "".join([str(x).upper() for x in row if x])
            row_str_clean = re.sub(r'\s+', '', row_str)
            if ("NAME" in row_str_clean or "名称" in row_str_clean) and \
               ("MODEL" in row_str_clean or "型号" in row_str_clean) and \
               ("PRICE" in row_str_clean or "单价" in row_str_clean):
                header_idx = idx
                break
                
        if header_idx != -1:
            headers = table[header_idx]
            # Map columns
            col_map = {}
            for c_idx, h in enumerate(headers):
                if not h: 
                    continue
                h_clean = h.strip().upper()
                if "NAME" in h_clean or "名称" in h_clean:
                    col_map["item_name"] = c_idx
                elif "MODEL" in h_clean or "型号" in h_clean:
                    col_map["model"] = c_idx
                elif "PRICE" in h_clean or "单价" in h_clean:
                    col_map["rate"] = c_idx
                elif "QUANTITY" in h_clean or "数量" in h_clean or "QTY" in h_clean:
                    col_map["qty"] = c_idx
                elif "AMOUNT" in h_clean or "合计" in h_clean:
                    col_map["amount"] = c_idx
            
            # Extract items from rows after header
            for r_idx in range(header_idx + 1, len(table)):
                row = table[r_idx]
                if not row or all(x is None or str(x).strip() == "" for x in row):
                    continue
                    
                # Stop if we hit the Total row
                first_cell = str(row[0] or '').strip().upper()
                if "TOTAL" in first_cell or "合计" in first_cell:
                    break
                    
                # Also skip rows that don't have a valid item name or model
                item_name = str(row[col_map["item_name"]] or '').strip() if "item_name" in col_map else ""
                model = str(row[col_map["model"]] or '').strip() if "model" in col_map else ""
                if not item_name and not model:
                    continue
                    
                qty_raw = row[col_map["qty"]] if "qty" in col_map else None
                rate_raw = row[col_map["rate"]] if "rate" in col_map else None
                
                qty = safe_int(qty_raw)
                rate = safe_float(rate_raw)
                
                if qty is not None or rate is not None:
                    item_data = {
                        "product_code": model if model else item_name,
                        "base_price": rate,
                        "quantity": qty if qty is not None else 0,
                        "note": item_name,
                        "extra_data": {
                            "model": model,
                            "name": item_name
                        }
                    }
                    data["items"].append(item_data)
                    
            # Once we find the main table, break (do not parse configuration tables)
            break
            
    # 5. Parse Total Amount CIF
    # Look in the table or text for total amount
    total_match = re.search(r'Total\s*(?:Amount)?\s*(\d+\s+)?(?:USD|US\$|\$)?\s*([\d,]+\.\d{2})', full_text, re.IGNORECASE)
    if total_match:
        data["total_amount_CIF"] = safe_float(total_match.group(2))
    else:
        # Fallback to sum of items
        total = 0.0
        for item in data["items"]:
            total += (item["quantity"] or 0) * (item["base_price"] or 0.0)
        data["total_amount_CIF"] = total
        
    return data
