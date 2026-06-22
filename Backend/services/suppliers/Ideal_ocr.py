"""
Ideal_ocr.py
============================================================
Logic-based PDF extractor for IDEAL (Sabar).
Supports both English and Vietnamese versions.
"""

import pdfplumber
import re
import json
import io
import sys

def extract_product_code_fallback(description: str) -> str:
    """
    Constructs a clean product code from item description dimensions (for Vietnamese version).
    """
    desc_clean = re.sub(r'\s+', ' ', description)
    dia_match = re.search(r'(?:đường kính|dia\.?)\s*(\d+)', desc_clean, re.IGNORECASE)
    h_match = re.search(r'(\d+)\s*(?:mm)?\s*(?:chiều cao|height|h)', desc_clean, re.IGNORECASE)
    t_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:độ dày|thick|t)', desc_clean, re.IGNORECASE)
    
    parts = []
    if dia_match:
        parts.append(dia_match.group(1))
    if h_match:
        parts.append(h_match.group(1))
    if t_match:
        parts.append(t_match.group(1))
        
    if len(parts) >= 2:
        return "HDPE " + "x".join(parts)
    
    # Fallback to first few words
    words = description.split()
    return " ".join(words[:4])

def safe_float(val):
    if val is None: return None
    clean_val = str(val).strip().replace('$', '').replace(',', '').replace(' ', '')
    try:
        return float(clean_val)
    except ValueError:
        return None

def safe_int(val):
    if val is None: return None
    clean_val = str(val).strip().replace('$', '').replace(',', '').replace(' ', '')
    try:
        return int(float(clean_val))
    except ValueError:
        return None

def Ideal_extract(file_bytes: bytes) -> dict:
    """
    Unified extraction logic for Ideal (Sabar) PDF quotes.
    Handles English format with Item Code/Item Name as well as Vietnamese-translated format.
    """
    pdf_file = io.BytesIO(file_bytes)

    with pdfplumber.open(pdf_file) as pdf:
        full_text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        
        all_tables = []
        for page in pdf.pages:
            all_tables.extend(page.extract_tables())

    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 3,
        "supplier_name": "IDEAL",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": None,
        "payment_method": None,
        "items": []
    }

    # --- Extract metadata from text ---
    # 1. Invoice Code (QT No or Số/No)
    qt_match = re.search(r'(?:Số/No|No|QT\s*No\.?)\s*[:.]?\s*([A-Za-z0-9\-]+)', full_text, re.IGNORECASE)
    if qt_match:
        data["invoice_code"] = qt_match.group(1).strip()

    # 2. Date
    # Try English Date format: Date: 15-12-2025
    date_match_en = re.search(r'Date\s*:\s*(\d{1,2})[-/](\d{2})[-/](\d{4})', full_text, re.IGNORECASE)
    if date_match_en:
        d = date_match_en.group(1).zfill(2)
        m = date_match_en.group(2).zfill(2)
        y = date_match_en.group(3)
        data["date"] = f"{y}-{m}-{d}"
    else:
        # Try Vietnamese Date format: Ngày 29 tháng 12 năm 2025
        date_match_vi = re.search(r'Ngày\s*(\d+)\s*tháng\s*(\d+)\s*năm\s*(\d+)', full_text, re.IGNORECASE)
        if date_match_vi:
            d = date_match_vi.group(1).zfill(2)
            m = date_match_vi.group(2).zfill(2)
            y = date_match_vi.group(3)
            data["date"] = f"{y}-{m}-{d}"

    # 3. Payment Method
    # Try English: Payment Terms: ...
    payment_match = re.search(r'Payment\s*Terms?\s*:\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if payment_match:
        data["payment_method"] = payment_match.group(1).strip()
    else:
        # Try Vietnamese keywords/patterns
        if "L/C AT SIGHT" in full_text.upper():
            data["payment_method"] = "L/C at sight"
        elif "T/T" in full_text.upper():
            data["payment_method"] = "T/T"

    # 4. Total Amount CIF
    # Try Rounded Total first
    rounded_match = re.search(r'Rounded\s*Total\s*(?:USD|\$)?\s*([\d,]+\.\d{2})', full_text, re.IGNORECASE)
    cif_match = re.search(r'(?:Tổng\s*giá\s*trị\s*CIF|CIF)\s*[^$\n]*\$\s*([\d,]+\.\d{2})', full_text, re.IGNORECASE)
    grand_total_match = re.search(r'Grand\s*Total\s*(?:USD|\$)?\s*([\d,]+\.\d{2})', full_text, re.IGNORECASE)
    
    if rounded_match:
        data["total_amount_CIF"] = safe_float(rounded_match.group(1))
    elif cif_match:
        data["total_amount_CIF"] = safe_float(cif_match.group(1))
    elif grand_total_match:
        data["total_amount_CIF"] = safe_float(grand_total_match.group(1))

    # --- Extract items from tables ---
    # Find the table that contains headers like "description" / "mô tả" and "qty" / "số lượng"
    for table in all_tables:
        if not table or len(table) < 2:
            continue
        
        # Look for header row
        header_idx = -1
        col_mapping = {}
        headers = []
        
        for idx, row in enumerate(table):
            # Check if this row is the header row, stripping all whitespace/newlines
            row_str = "".join([str(x).upper() for x in row if x])
            row_str_cleaned = re.sub(r'\s+', '', row_str)
            if ("DESCRIPTION" in row_str_cleaned or "MÔTẢ" in row_str_cleaned) and ("QTY" in row_str_cleaned or "SỐLƯỢNG" in row_str_cleaned):
                headers = [str(x).strip().replace('\n', ' ') for x in row]
                header_idx = idx
                break
                
        if header_idx != -1:
            # Map columns
            for idx, h in enumerate(headers):
                h_clean = re.sub(r'\s+', '', h.upper())
                if "DESCRIPTION" in h_clean or "MÔTẢ" in h_clean:
                    col_mapping[idx] = "description"
                elif "QTY" in h_clean or "SỐLƯỢNG" in h_clean:
                    col_mapping[idx] = "qty"
                elif "RATE" in h_clean or "ĐƠNGIÁ" in h_clean:
                    col_mapping[idx] = "rate"
                elif "AMOUNT" in h_clean or "THÀNHTIỀN" in h_clean:
                    col_mapping[idx] = "amount"
                else:
                    col_mapping[idx] = "extra"
                    
            # Process rows after header
            for idx in range(header_idx + 1, len(table)):
                row = table[idx]
                row_str_upper = " ".join([str(x).upper() for x in row if x])
                
                # Stop if we hit a total row (Total, Grand Total, Tổng, etc.)
                if any(k in row_str_upper for k in ["TOTAL", "GRAND TOTAL", "TỔNG", "TỔNG TIỀN"]):
                    break
                    
                desc_val = ""
                qty_val = None
                rate_val = None
                extra_data = {}
                
                for c_idx, cell_val in enumerate(row):
                    if cell_val is None:
                        continue
                    role = col_mapping.get(c_idx, "extra")
                    val_str = str(cell_val).strip()
                    
                    if role == "description":
                        desc_val = val_str
                    elif role == "qty":
                        qty_val = safe_int(val_str)
                    elif role == "rate":
                        rate_val = safe_float(val_str)
                    elif role == "extra":
                        h_name = headers[c_idx] if c_idx < len(headers) else f"Column_{c_idx}"
                        extra_data[h_name] = val_str
                        
                # Only add if we have at least a description and qty or price
                if desc_val and (qty_val is not None or rate_val is not None):
                    # Check for English format (Item Code / Item Name inside description)
                    code_match = re.search(r'Item\s*Code\s*:\s*([^\n\r]+)', desc_val, re.IGNORECASE)
                    name_match = re.search(r'Item\s*Name\s*:\s*([^\n\r]+)', desc_val, re.IGNORECASE)
                    
                    item_code = code_match.group(1).strip() if code_match else None
                    item_name = name_match.group(1).strip() if name_match else None
                    
                    if not item_code:
                        # Fallback for Vietnamese version: generate product code
                        item_code = extract_product_code_fallback(desc_val)
                    
                    item_data = {
                        "product_code": item_code,
                        "base_price": rate_val,
                        "quantity": qty_val,
                        "note": item_name if item_name else None,
                        "extra_data": {
                            "Description": desc_val,
                            **extra_data
                        }
                    }
                    if item_name:
                        item_data["extra_data"]["Item Name"] = item_name
                        
                    data["items"].append(item_data)
            
            # Break out of table loop once we found and parsed the items table
            break

    return data
