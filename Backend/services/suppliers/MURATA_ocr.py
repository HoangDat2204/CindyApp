"""
MURATA_ocr.py
============================================================
Logic-based PDF extractor for MURATA (Automatic Cone Winding Machine).
Supplier ID: 14
"""

import pdfplumber
import re
import io
from datetime import datetime

def parse_price(val):
    if not val:
        return 0.0
    clean_val = str(val).strip().replace('$', '').replace(',', '').replace(' ', '')
    try:
        return float(clean_val)
    except ValueError:
        return 0.0

def MURATA_extract(file_bytes: bytes) -> dict:
    """
    Trích xuất thông tin báo giá từ file PDF của MURATA.
    """
    pdf_file = io.BytesIO(file_bytes)
    full_text = ""
    
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
            
    # Verify header signature
    header_found = (
        "TEXTILE MACHINERY DIVISION" in full_text.upper() and
        "TAKEDA-MUKAISHIRO-CHO" in full_text.upper() and
        "KYOTO 612-8686 JAPAN" in full_text.upper()
    )
    if not header_found:
        raise ValueError("Không tìm thấy chữ ký header hợp lệ của MURATA.")
        
    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 14,
        "supplier_name": "MURATA",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "currency": "USD",
        "items": []
    }
    
    # 1. Mã báo giá (No.: HTN20260209001)
    code_match = re.search(r'No\.:\s*(\S+)', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
        
    # 2. Ngày báo giá (Date: 2026/2/9)
    date_match = re.search(r'Date:\s*(\d{4})/(\d{1,2})/(\d{1,2})', full_text, re.IGNORECASE)
    if date_match:
        y, m, d = date_match.groups()
        data["date"] = f"{y}-{int(m):02d}-{int(d):02d}"
        
    # 3. Phương thức thanh toán (Terms of payment : By an irrevocable L/C. due at sight)
    payment_match = re.search(r'Terms\s+of\s+payment\s*:\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if payment_match:
        data["payment_method"] = payment_match.group(1).strip()
        
    # 4. Tổng tiền CIF (Total CIF Ho Chi Minh in Dollar $130,000)
    total_match = re.search(r'Total\s+CIF\s+.*?(?:\$)?\s*([\d,]+)', full_text, re.IGNORECASE)
    if total_match:
        data["total_amount_CIF"] = parse_price(total_match.group(1))
        
    # 5. Trích xuất danh sách sản phẩm nằm trước phần "Total CIF"
    lines = full_text.split('\n')
    item_section_started = False
    item_lines = []
    
    for line in lines:
        line_strip = line.strip()
        if "Item Q'ty Unit Price Total Price" in line_strip:
            item_section_started = True
            continue
        if item_section_started:
            if "Total CIF" in line_strip:
                break
            item_lines.append(line_strip)
            
    current_item = None
    for line in item_lines:
        if not line:
            continue
            
        # Bỏ qua dòng tiêu đề "Optional Devices:"
        if "Optional Devices:" in line:
            continue
            
        # Kiểm tra sản phẩm chính Link Coner:
        # Ví dụ: 30 drums / 32 frame 1 set(s) $130,000 $130,000
        main_match = re.search(r'(\d+)\s+drums\s*/\s*(\d+)\s+frame\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)', line, re.IGNORECASE)
        if main_match:
            drums = int(main_match.group(1))
            frame = int(main_match.group(2))
            qty = int(main_match.group(3))
            unit = main_match.group(4)
            price = parse_price(main_match.group(5))
            amount = parse_price(main_match.group(6))
            
            current_item = {
                "product_code": "Link Coner",
                "base_price": price,
                "quantity": qty,
                "note": "",
                "extra_data": {
                    "drums": drums,
                    "frame": frame,
                    "drums_frame": f"{drums} drums / {frame} frame",
                    "unit": unit,
                    "amount": amount
                }
            }
            data["items"].append(current_item)
            continue
            
        # Kiểm tra sản phẩm phụ thuộc / đi kèm có chữ "included":
        # Ví dụ: Standard Spare Parts 1 lot included
        # Ví dụ: 1) PAC 21 (Process cartridge winding system) 1 set(s) included
        included_match = re.search(r'(?:\d+\)\s*)?(.*?)\s+(\d+)\s+(\S+)\s+included', line, re.IGNORECASE)
        if included_match:
            prod_name = included_match.group(1).strip()
            qty = int(included_match.group(2))
            unit = included_match.group(3).strip()
            
            current_item = {
                "product_code": prod_name,
                "base_price": 0.0,
                "quantity": qty,
                "note": "",
                "extra_data": {
                    "unit": unit
                }
            }
            data["items"].append(current_item)
            continue
            
        # Nếu là dòng mô tả/chú thích, thêm vào item hiện tại
        if current_item is not None:
            if current_item["note"]:
                current_item["note"] += " " + line
            else:
                current_item["note"] = line
                
    # Dọn dẹp trường ghi chú rỗng
    for item in data["items"]:
        if item["note"]:
            item["note"] = item["note"].strip()
        else:
            item["note"] = None
            
    return data
