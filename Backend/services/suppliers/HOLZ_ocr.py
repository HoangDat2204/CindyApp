"""
HOLZ_ocr.py
============================================================
Logic-based PDF extractor for HOLZ (Fabrik für Textilmaschinen-Zubehör e.K.).
Supplier ID: 13
"""

import pdfplumber
import re
import io
from datetime import datetime

def parse_german_float(val):
    if not val:
        return 0.0
    val = str(val).strip().replace('.', '').replace(',', '.')
    try:
        return float(val)
    except ValueError:
        return 0.0

def HOLZ_extract(file_bytes: bytes) -> dict:
    """
    Trích xuất thông tin báo giá từ file PDF của HOLZ.
    """
    pdf_file = io.BytesIO(file_bytes)
    full_text = ""
    
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
            
    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 13,
        "supplier_name": "HOLZ",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "currency": "EUR",
        "items": []
    }
    
    # Kiểm tra dòng HOLZ Fabrik für Textilmaschinen-Zubehör e.K. ở header
    if "HOLZ" not in full_text or "FABRIK FÜR TEXTILMASCHINEN-ZUBEHÖR E.K." not in full_text.upper():
        raise ValueError("Không tìm thấy dòng chữ ký HOLZ Fabrik für Textilmaschinen-Zubehör e.K. ở header.")
        
    # 1. Mã báo giá (Rechnung 20562/26)
    code_match = re.search(r'Rechnung\s*\n\s*(\S+)', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
        
    # 2. Ngày báo giá (Date: 03.04.2026/S.Sch)
    date_match = re.search(r'Date:\s*(\d{2})\.(\d{2})\.(\d{4})', full_text, re.IGNORECASE)
    if date_match:
        d = date_match.group(1)
        m = date_match.group(2)
        y = date_match.group(3)
        data["date"] = f"{y}-{m}-{d}"
        
    # 3. Phương thức thanh toán (Payment: in advance by T/T remittance)
    payment_match = re.search(r'Payment:\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if payment_match:
        data["payment_method"] = payment_match.group(1).strip()
        
    # 4. Tổng tiền CIP (TOTAL CIP HO CHI MINH CITY AIRPORT EUR 3.915,85)
    total_match = re.search(r'TOTAL\s+CIP\s+.*?(?:EUR|€)\s*([\d.,]+)', full_text, re.IGNORECASE)
    if total_match:
        data["total_amount_CIF"] = parse_german_float(total_match.group(1))
        
    # 5. Trích xuất danh sách sản phẩm
    # Ví dụ: 120 pcs. Special Steel Presser UGK 16x6”, 00.2.148 € 24,95 EUR 2.994,00
    item_pattern = re.compile(
        r'(\d+)\s*pcs\.\s+(.*?),\s*([A-Za-z0-9.-]+)\s*€\s*([\d.,]+)\s*EUR\s*([\d.,]+)',
        re.IGNORECASE
    )
    
    stop_keywords = [
        "TOTAL", "VALIDITY:", "DELIVERY:", "PACKING:", "PAYMENT:", 
        "COUNTRY OF ORIGIN:", "HS-CODE:", "LOOKING FORWARD", "GROSS WEIGHT:", "NET WEIGHT:"
    ]
    
    lines = full_text.split('\n')
    current_item = None
    
    for idx, line in enumerate(lines):
        line_strip = line.strip()
        if not line_strip:
            continue
            
        m = item_pattern.match(line_strip)
        if m:
            qty = int(m.group(1))
            desc = m.group(2).strip()
            part_no = m.group(3).strip()
            rate = parse_german_float(m.group(4))
            amount = parse_german_float(m.group(5))
            
            combined_code = f"{desc}, {part_no}"
            
            current_item = {
                "product_code": combined_code,
                "base_price": rate,
                "quantity": qty,
                "note": "",
                "extra_data": {
                    "Description": desc,
                    "Amount": amount
                }
            }
            data["items"].append(current_item)
        else:
            line_upper = line_strip.upper()
            if any(k in line_upper for k in stop_keywords):
                current_item = None
                continue
                
            if current_item is not None:
                if current_item["note"]:
                    current_item["note"] += " " + line_strip
                else:
                    current_item["note"] = line_strip
                    
    # Làm sạch ghi chú sau cùng
    for item in data["items"]:
        if item["note"]:
            item["note"] = item["note"].strip()
        else:
            item["note"] = None
            
    return data
