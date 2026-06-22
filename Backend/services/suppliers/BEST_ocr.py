"""
BEST_ocr.py
============================================================
Logic-based PDF extractor for BEST (BEST MACHINERY IMPORT AND EXPORT CO.,LTD.).
Supplier ID: 15
"""

import pdfplumber
import re
import io
from datetime import datetime

def parse_price(val):
    if not val:
        return 0.0
    clean_val = str(val).strip().replace('$', '').replace('US$', '').replace(',', '').replace(' ', '')
    try:
        return float(clean_val)
    except ValueError:
        return 0.0

def parse_qty(val):
    if not val:
        return 0
    m = re.search(r'\d+', str(val))
    if m:
        return int(m.group(0))
    return 0

def BEST_extract(file_bytes: bytes) -> dict:
    """
    Trích xuất thông tin báo giá từ file PDF của BEST.
    """
    pdf_file = io.BytesIO(file_bytes)
    full_text = ""
    
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
        # Get tables on page 0
        tables = pdf.pages[0].extract_tables()
            
    # Verify header signature
    if "BEST MACHINERY IMPORT AND EXPORT CO.,LT" not in full_text:
        raise ValueError("Không tìm thấy dòng chữ ký header hợp lệ của BEST.")
        
    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 15,
        "supplier_name": "BEST",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "currency": "USD",
        "items": []
    }
    
    # 1. Mã báo giá (NO.V-010) - tìm trên đúng dòng có DATE:
    for line in full_text.splitlines():
        code_match = re.search(r'\bNO\.\s*([A-Za-z]\S+)', line, re.IGNORECASE)
        if code_match:
            data["invoice_code"] = code_match.group(1).strip()
            break
        
    # 2. Ngày báo giá (DATE: DEC.24.2025)
    date_match = re.search(r'DATE:\s*([A-Za-z]+)\.?\s*(\d{1,2})\.?\s*(\d{4})', full_text, re.IGNORECASE)
    if date_match:
        m_str, d, y = date_match.groups()
        months_map = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }
        month = months_map.get(m_str.lower()[:3], 1)
        data["date"] = f"{y}-{month:02d}-{int(d):02d}"
        
    # 3. Phương thức thanh toán (PAYMENT TERM: 100% IRREVOCABLE LC AT SIGHT DRAFT...)
    payment_match = re.search(r'PAYMENT\s+TERM:\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if payment_match:
        raw_payment = payment_match.group(1).strip()
        # Lấy phần trước DRAFT hoặc toàn bộ dòng
        if "DRAFT" in raw_payment:
            data["payment_method"] = raw_payment.split("DRAFT")[0].strip() + " DRAFT"
        else:
            data["payment_method"] = raw_payment
        
    # 4. Tổng tiền CIF (AMOUNT CIF HOCHIMINH: US$ 410,400.00)
    total_match = re.search(r'AMOUNT\s+CIF\s+HOCHIMINH:\s*(?:US\$|\$)?\s*([\d,]+\.\d{2})', full_text, re.IGNORECASE)
    if total_match:
        data["total_amount_CIF"] = parse_price(total_match.group(1))
        
    # 5. Trích xuất danh sách sản phẩm từ bảng trên trang 0 (chỉ lấy máy chính, không lấy chi tiết spec ở trang 1)
    if tables:
        table = tables[0]
        header_idx = -1
        col_mapping = {}
        
        for idx, row in enumerate(table):
            row_str = "".join([str(x).upper() for x in row if x])
            if "DESCRIPTION" in row_str and "QTY" in row_str and "RATE" in row_str:
                header_idx = idx
                for c_idx, cell in enumerate(row):
                    cell_upper = str(cell).upper()
                    if "DESCRIPTION" in cell_upper:
                        col_mapping[c_idx] = "description"
                    elif "QTY" in cell_upper:
                        col_mapping[c_idx] = "qty"
                    elif "RATE" in cell_upper:
                        col_mapping[c_idx] = "rate"
                    elif "AMOUNT" in cell_upper:
                        col_mapping[c_idx] = "amount"
                break
                
        if header_idx != -1:
            for idx in range(header_idx + 1, len(table)):
                row = table[idx]
                if not row[0] or "AMOUNT CIF" in str(row[0]).upper():
                    continue
                    
                desc_val = ""
                qty_val = 0
                rate_val = 0.0
                amount_val = 0.0
                
                for c_idx, cell_val in enumerate(row):
                    if cell_val is None:
                        continue
                    role = col_mapping.get(c_idx, "extra")
                    if role == "description":
                        desc_val = str(cell_val).strip()
                    elif role == "qty":
                        qty_val = parse_qty(cell_val)
                    elif role == "rate":
                        rate_val = parse_price(cell_val)
                    elif role == "amount":
                        amount_val = parse_price(cell_val)
                        
                if desc_val:
                    desc_lines = desc_val.split('\n')
                    machine_code = desc_lines[0].split()[0] if desc_lines else "BS576E1-1440"
                    note_desc = " ".join([l.strip() for l in desc_lines])
                    
                    item_data = {
                        "product_code": machine_code,
                        "base_price": rate_val,
                        "quantity": qty_val,
                        "note": note_desc,
                        "extra_data": {
                            "Description": desc_val,
                            "Amount": amount_val
                        }
                    }
                    data["items"].append(item_data)
                    
    return data
