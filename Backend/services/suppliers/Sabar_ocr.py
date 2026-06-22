"""
Sabar_ocr.py
============================================================
Logic-based PDF extractor for SABAR.
Supplier ID: 9
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
            return int(float(match.group(0)))
        return 0
    except ValueError:
        return 0

def extract_product_code_sabar(description: str) -> str:
    lines = [l.strip() for l in description.split('\n') if l.strip()]
    if lines:
        return lines[0]
    return "SABAR Make Rivetless HDPE Sliver Cans"

def Sabar_extract(file_bytes: bytes) -> dict:
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
        "supplier_id": 9,
        "supplier_name": "Sabar Spinmatic Equipments LLP",
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": 0.0,
        "payment_method": "no info",
        "items": []
    }
    
    # 1. Parse Proforma Invoice Code (invoice_code)
    # Pattern: SSE:PHO:111225
    code_match = re.search(r'(SSE:[A-Za-z0-9:]+)', full_text)
    if code_match:
        data["invoice_code"] = code_match.group(1).strip()
    else:
        # Fallback to search under NO. DATE
        code_match = re.search(r'(?:Proforma\s*Invoice|Invoice|No\.)\s*\n?\s*NO\.\s*DATE\s*\n\s*([A-Za-z0-9:]+)', full_text, re.IGNORECASE)
        if code_match:
            data["invoice_code"] = code_match.group(1).strip()
            
    # 2. Parse Date (DD/MM/YYYY)
    date_match = re.search(r'(\d{2})/(\d{2})/(\d{4})', full_text)
    if date_match:
        d = date_match.group(1)
        m = date_match.group(2)
        y = date_match.group(3)
        data["date"] = f"{y}-{m}-{d}"
        
    # 3. Parse Payment Method
    # Try: 100% payment in advance by bank T.T. or against L/C at sight from 1st class bank.
    pay_match = re.search(r'Payment\s*Terms?\s*:\s*\n?\s*([^\n\r]+)', full_text, re.IGNORECASE)
    if pay_match:
        data["payment_method"] = pay_match.group(1).strip()
    else:
        # Check general TT or LC keywords
        if "T.T." in full_text or "T/T" in full_text:
            data["payment_method"] = "TT"
        elif "L/C" in full_text:
            data["payment_method"] = "L/C at sight"

    # 4. Parse Items from tables
    for table in all_tables:
        if not table or len(table) < 1:
            continue
        
        # Check if table has at least 4 columns
        if len(table[0]) < 4:
            continue
            
        for row in table:
            if not row or len(row) < 4:
                continue
                
            val_col = str(row[-1]).strip() if row[-1] is not None else ""
            price_col = str(row[-2]).strip() if row[-2] is not None else ""
            qty_col = str(row[-3]).strip() if row[-3] is not None else ""
            desc_col = str(row[-4]).strip() if row[-4] is not None else ""
            
            # Skip header rows
            if "description" in desc_col.lower() or "unit price" in price_col.lower():
                continue
                
            # Skip totals or charges
            if any(x in desc_col.lower() for x in ["total", "c.i.f", "insurance", "freight", "inland"]):
                continue
                
            qty = safe_int(qty_col)
            price = safe_float(price_col)
            
            if qty == 0 and price == 0.0:
                continue
                
            prod_code = extract_product_code_sabar(desc_col)
            
            # Use first line of description as note
            lines = [l.strip() for l in desc_col.split('\n') if l.strip()]
            note = lines[0] if lines else prod_code
            
            item = {
                "product_code": prod_code,
                "note": note,
                "quantity": qty,
                "base_price": price,
                "extra_data": {
                    "Description": desc_col,
                    "Unit Price": price,
                    "Total Price": qty * price
                }
            }
            data["items"].append(item)

    # 5. Parse Total Amount CIF
    # Pattern: Total C.I.F. HCMC port, Vietnam $ 37,721.00
    cif_match = re.search(r'Total\s*C\.?I\.?F\.?[^0-9]*([\d.,]+)', full_text, re.IGNORECASE)
    if cif_match:
        data["total_amount_CIF"] = safe_float(cif_match.group(1))
    else:
        # Fallback sum
        total = 0.0
        for item in data["items"]:
            total += (item["quantity"] or 0) * (item["base_price"] or 0.0)
        data["total_amount_CIF"] = total
        
    return data
