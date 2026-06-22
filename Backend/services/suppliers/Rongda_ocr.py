"""
Rongda_ocr.py
============================================================
Logic-based PDF extractor for Rongda.
Supplier ID: 8
"""

import pdfplumber
import re
import io

def safe_float(val):
    if val is None:
        return 0.0
    val_str = str(val).strip().lower()
    
    # Remove currency symbols or non-numeric chars except digits, dot, comma, signs
    val_str = re.sub(r'[^\d.,+-]', '', val_str)
    
    # If there is a comma and a dot:
    if ',' in val_str and '.' in val_str:
        if val_str.find('.') < val_str.find(','):
            # dot is thousands, comma is decimal (e.g. 25.000,00)
            val_str = val_str.replace('.', '').replace(',', '.')
        else:
            # comma is thousands, dot is decimal (e.g. 10,032.00)
            val_str = val_str.replace(',', '')
    elif ',' in val_str:
        # Multiple commas or single comma
        if val_str.count(',') > 1:
            parts = val_str.split(',')
            val_str = "".join(parts[:-1]) + "." + parts[-1]
        else:
            # Single comma: check if it's decimal or thousands separator
            parts = val_str.split(',')
            if len(parts) == 2 and len(parts[1]) == 2:
                val_str = val_str.replace(',', '.')
            else:
                val_str = val_str.replace(',', '')
    try:
        match = re.search(r'[-+]?\d*\.?\d+', val_str)
        if match:
            return float(match.group(0))
        return 0.0
    except ValueError:
        return 0.0

def safe_int(val):
    if val is None:
        return 0
    val_str = str(val).strip().lower()
    try:
        match = re.search(r'\d+', val_str)
        if match:
            return int(match.group(0))
        return 0
    except ValueError:
        return 0

def get_cell_value(cell):
    if cell is None:
        return ""
    val_str = str(cell).strip()
    if not val_str:
        return ""
    
    # Check if it has a header part we should strip (due to pdfplumber merging)
    lines = val_str.split('\n')
    if len(lines) >= 2:
        first_line = lines[0].upper()
        if any(h in first_line for h in ["DESCRIOTION", "DESCRIPTION", "UNIT", "MODEL", "QTY", "Q’TY", "PRICE", "AMOUNT", "REMARKS"]):
            # Strip headers and join the remaining lines
            return " ".join([l.strip() for l in lines[1:] if l.strip()])
    
    # Just join all lines with a space
    return " ".join([l.strip() for l in lines if l.strip()])

def Rongda_extract(file_bytes: bytes) -> dict:
    pdf_file = io.BytesIO(file_bytes)
    full_text = ""
    all_tables = []
    
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
            tables = page.extract_tables()
            if tables:
                all_tables.extend(tables)
            
    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 8,
        "supplier_name": "Rongda",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "items": []
    }
    
    # 1. Parse FileNo / Quotation Number (invoice_code)
    # Pattern: FileNo:HNV20260209
    code_match = re.search(r'FileNo\s*:\s*([A-Za-z0-9]+)', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
    
    # 2. Parse Date
    # Try to extract date from FileNo first (e.g. HNV20260209 -> 2026-02-09)
    if data["invoice_code"]:
        date_num_match = re.search(r'\d{8}', data["invoice_code"])
        if date_num_match:
            d_str = date_num_match.group(0)
            data["date"] = f"{d_str[:4]}-{d_str[4:6]}-{d_str[6:]}"
            
    if not data["date"]:
        # Fallback to normal date format YYYY-MM-DD
        date_match = re.search(r'(\d{4})[-/](\d{2})[-/](\d{2})', full_text)
        if date_match:
            data["date"] = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"
        
    # 3. Parse Payment Method
    # Pattern: Payment: 100% TT must be paid before shipment.
    pay_match = re.search(r'Payment\s*:\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if pay_match:
        data["payment_method"] = pay_match.group(1).strip()
    else:
        # Fallback to payment terms if present
        pay_terms_match = re.search(r'Payment\s*Terms?\s*:\s*([^\n\r]+)', full_text, re.IGNORECASE)
        if pay_terms_match:
            data["payment_method"] = pay_terms_match.group(1).strip()

    # 4. Parse Items from tables
    current_item = None
    for table in all_tables:
        if not table or len(table) < 1:
            continue
        
        # Check if table has a header
        has_header = False
        for row in table:
            row_str = " ".join([str(x) for x in row if x]).upper()
            if "DESCRIOTION" in row_str or "DESCRIPTION" in row_str:
                has_header = True
                break
                
        if not has_header:
            continue
            
        for row in table:
            if not row:
                continue
                
            row_str_upper = " ".join([str(x) for x in row if x]).upper()
            if "DESCRIOTION" in row_str_upper or "DESCRIPTION" in row_str_upper:
                col0 = str(row[0]).strip() if row[0] is not None else ""
                if not re.search(r'\n\d+', col0) and not re.match(r'^\d+$', col0):
                    continue
            if "COMPANY." in row_str_upper or "COMMERCIAL INVOICE" in row_str_upper:
                continue
            if "GRANDTOTAL" in row_str_upper or "GRAND TOTAL" in row_str_upper:
                continue
                
            col0 = str(row[0]).strip() if row[0] is not None else ""
            
            starts_new_item = False
            
            # Match item number e.g. "1.", "2.", "1", "2"
            match_no = re.match(r'^(\d+)\.?$', col0)
            if match_no:
                starts_new_item = True
            elif col0.startswith("NO\n") or "\n" in col0:
                lines = col0.split('\n')
                if len(lines) >= 2:
                    last_line = lines[-1].strip()
                    match_last = re.match(r'^(\d+)\.?$', last_line)
                    if match_last:
                        starts_new_item = True
                        
            if starts_new_item:
                desc = get_cell_value(row[1])
                unit = get_cell_value(row[2])
                model = get_cell_value(row[3])
                qty_str = get_cell_value(row[4])
                price_str = get_cell_value(row[5])
                amount_str = get_cell_value(row[6])
                remarks = get_cell_value(row[7])
                
                qty = safe_int(qty_str) if qty_str else 0
                price = safe_float(price_str) if price_str else 0.0
                
                note_parts = []
                if model:
                    note_parts.append(f"MODEL: {model}")
                if unit:
                    note_parts.append(f"UNIT: {unit}")
                if remarks:
                    note_parts.append(f"REMARKS: {remarks}")
                note = ", ".join(note_parts)
                
                current_item = {
                    "product_code": desc,
                    "note": note,
                    "quantity": qty,
                    "base_price": price,
                    "extra_data": {
                        "Description": desc,
                        "Unit Price": price,
                        "Total Price": qty * price
                    }
                }
                data["items"].append(current_item)
            else:
                if current_item and col0:
                    current_item["product_code"] = (current_item["product_code"] + " " + col0).strip()
                    current_item["extra_data"]["Description"] = current_item["product_code"]
                    
                    rem_val = get_cell_value(row[-1])
                    if rem_val:
                        if current_item["note"]:
                            current_item["note"] = current_item["note"] + " " + rem_val
                        else:
                            current_item["note"] = rem_val
                            
    # Clean up empty notes or leading/trailing formatting on items
    for item in data["items"]:
        # Strip notes and replace double spaces
        item["note"] = re.sub(r'\s+', ' ', item["note"]).strip()
        item["product_code"] = re.sub(r'\s+', ' ', item["product_code"]).strip()
        item["extra_data"]["Description"] = item["product_code"]

    # 5. Parse Total Amount CIF
    # Pattern: GrandTotal 1163 CIF,HOCHIMINHPORT
    cif_match = re.search(r'Grand\s*Total\s*[^0-9]*([\d.,]+)', full_text, re.IGNORECASE)
    if cif_match:
        data["total_amount_CIF"] = safe_float(cif_match.group(1))
    else:
        # Fallback sum
        total = 0.0
        for item in data["items"]:
            total += (item["quantity"] or 0) * (item["base_price"] or 0.0)
        data["total_amount_CIF"] = total
        
    return data
