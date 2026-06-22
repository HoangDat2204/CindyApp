"""
Pinter_ocr.py
============================================================
Logic-based PDF extractor for Pinter.
Supplier ID: 7
"""

import pdfplumber
import re
import io

def safe_float(val):
    if val is None:
        return 0.0
    val_str = str(val).strip().lower()
    if 'included' in val_str or 'include' in val_str:
        return 0.0
    
    # Remove currency symbols or non-numeric chars except digits, dot, comma
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

def get_product_name(text):
    if not text:
        return ""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        return ""
    
    # Rebuild the name line by line
    name_lines = []
    for line in lines:
        line_upper = line.upper()
        # If the line starts with known description starters, we stop adding to the name
        if (line_upper.startswith("INDIVIDUAL YARN") or 
            line_upper.startswith("ROVING STOP DEVICE") or
            line_upper.startswith("IT SUPPLIES POWER") or 
            line_upper.startswith("IT ALSO INCLUDES") or 
            line_upper.startswith("SHOWS THE DATA") or 
            line_upper.startswith("REMOTE CONTROL") or 
            line_upper.startswith("INSTALLED ON") or 
            line_upper.startswith("THIS IS THE M-TV") or 
            re.match(r'^\d+\)', line_upper)):  # e.g., 1) Dashboard
            break
        name_lines.append(line)
    
    return " ".join(name_lines)

def Pinter_extract(file_bytes: bytes) -> dict:
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
        "supplier_id": 7,
        "supplier_name": "Pinter S.A.",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "items": []
    }
    
    # 1. Parse Quotation Number (invoice_code)
    # Pattern: Proforma Invoice N°:PI-F-VN-2025-1219/1
    code_match = re.search(r'(?:Proforma\s*Invoice|Invoice|Offer)\s*(?:N[°o]\.?)?\s*[:：]?\s*([A-Za-z0-9\-/_\.]+)', full_text, re.IGNORECASE)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
    
    # 2. Parse Date
    # Pattern: Date:31/12/2025
    date_match = re.search(r'Date\s*[:：]\s*(\d{2})[/-](\d{2})[/-](\d{4})', full_text, re.IGNORECASE)
    if date_match:
        d = date_match.group(1).zfill(2)
        m = date_match.group(2).zfill(2)
        y = date_match.group(3)
        data["date"] = f"{y}-{m}-{d}"
        
    # 3. Parse Payment Method
    # Pattern: Payment terms: 30% T/T down payment 70% balance payment before shipment
    pay_match = re.search(r'(?:Payment\s*terms|Payment)\s*[:：]\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if pay_match:
        data["payment_method"] = pay_match.group(1).strip()

    # 4. Parse Items from tables
    for table in all_tables:
        if not table or len(table) < 1:
            continue
        
        # Check if table has at least 4 columns
        if len(table[0]) < 4:
            continue
            
        for r_idx, row in enumerate(table):
            if not row or len(row) < 4:
                continue
                
            desc_val = str(row[0]).strip() if row[0] else ""
            qty_val = str(row[1]).strip() if row[1] else ""
            unit_val = str(row[2]).strip() if row[2] else ""
            total_val = str(row[3]).strip() if row[3] else ""
            
            # Skip header rows
            desc_upper = desc_val.upper()
            if "DESCRIPTION" in desc_upper or "UNIT PRICE" in desc_upper or "Q.TY" in desc_upper:
                continue
                
            # Check for totals and charges to stop or skip
            if any(x in desc_upper for x in ["TOTAL EX-WORKS", "FREIGHT CHARGE", "INSURANCE", "TOTAL CIF"]):
                continue
                
            if not qty_val or qty_val == "" or qty_val is None:
                continue
                
            qty = safe_int(qty_val)
            if qty <= 0:
                continue
                
            # Extract clean product name
            prod_name = get_product_name(desc_val)
            if not prod_name:
                continue
                
            # Strip trailing ", comprising:" if present
            if prod_name.endswith(", comprising:"):
                prod_name = prod_name[:-13].strip()
                
            # Check if "Included" / "include" in price values
            is_included = False
            if 'included' in unit_val.lower() or 'included' in total_val.lower() or 'include' in unit_val.lower() or 'include' in total_val.lower():
                is_included = True
                
            # Get base price
            base_price = 0.0 if is_included else safe_float(unit_val)
            
            # Calculate total price: qty * base_price
            calculated_total = qty * base_price
            
            # Add to items
            item = {
                "product_code": prod_name,
                "note": prod_name,
                "quantity": qty,
                "base_price": base_price,
                "extra_data": {
                    "Description": prod_name,
                    "Unit Price": base_price,
                    "Total Price": calculated_total
                }
            }
            data["items"].append(item)

    # 5. Parse Total Amount CIF
    # Pattern: Total CIF Haiphong 196,540.03
    cif_match = re.search(r'(?:Total\s*CIF|CIF)\s*[^0-9]*([\d.,]+)', full_text, re.IGNORECASE)
    if cif_match:
        data["total_amount_CIF"] = safe_float(cif_match.group(1))
    else:
        # Fallback sum
        total = 0.0
        for item in data["items"]:
            total += (item["quantity"] or 0) * (item["base_price"] or 0.0)
        data["total_amount_CIF"] = total
        
    return data
