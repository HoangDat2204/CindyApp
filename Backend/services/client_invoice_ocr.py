"""
client_invoice_ocr.py
=====================================================================
Logic-based PDF extractor cho bao gia Timtex -> Khach hang (Client Invoice).
Nhan dien dua tren header: "TIMTEX TRADING CO.,LTD"
Ho tro: Parts, Machine, COMBINE (nhieu Inquiry No.)
"""

import pdfplumber
import re
import io
import sqlite3
import os
import hashlib

# Path to database
DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "database", "storage.db"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_price(val) -> float:
    if val is None:
        return 0.0
    s = str(val).strip()
    # European format: 71.457,00 -> 71457.00
    if re.search(r'\d\.\d{3},\d{2}', s):
        s = s.replace('.', '').replace(',', '.')
    else:
        s = s.replace(',', '')
    s = re.sub(r'[^\d.\-]', '', s)
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_qty(val) -> float:
    if val is None:
        return 0.0
    cleaned = str(val).replace(',', '')
    m = re.search(r'[\d]+\.?\d*', cleaned)
    if m:
        try:
            return float(m.group(0))
        except ValueError:
            return 0.0
    return 0.0


def detect_currency(text: str) -> str:
    upper = text.upper()
    if chr(165) in text or 'JPY' in upper:
        return 'JPY'
    if chr(8364) in text or 'EUR' in upper or '(EUR)' in upper:
        return 'EUR'
    if 'CHF' in upper or '(CHF)' in upper:
        return 'CHF'
    return 'USD'


def is_machine_invoice(text: str) -> bool:
    vn_keywords = [
        'BAN CHAO GIA TOYOTA', 'BAN CHAO GIA KAIGONG',
        'MAY DET', 'MAY CHAI', 'COTTON COMBER', 'SLIVER LAP WINDER',
        'RING SPINNING MACHINE', 'AIR-JET LOOM', 'JAT910', 'JSFA',
        'USTER JOSSI VISION',
    ]
    upper_ascii = text.upper().encode('ascii', errors='replace').decode('ascii')
    return any(kw in upper_ascii for kw in vn_keywords)


def get_or_create_client(client_name: str):
    if not client_name or not client_name.strip():
        return None
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM clients WHERE UPPER(name) = UPPER(?)", (client_name.strip(),))
    row = c.fetchone()
    if row:
        client_id = row[0]
    else:
        name_hash = hashlib.md5(client_name.strip().encode('utf-8')).hexdigest()[:12].upper()
        auto_tax_code = f"AUTO-{name_hash}"
        c.execute(
            "INSERT OR IGNORE INTO clients (name, tax_code, address, contact_info) VALUES (?, ?, ?, ?)",
            (client_name.strip(), auto_tax_code, '', '')
        )
        conn.commit()
        c.execute("SELECT id FROM clients WHERE UPPER(name) = UPPER(?)", (client_name.strip(),))
        row2 = c.fetchone()
        client_id = row2[0] if row2 else None
    conn.close()
    return client_id


def parse_date_vn(text: str):
    months = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6,
        'july': 7, 'august': 8, 'september': 9, 'october': 10,
        'november': 11, 'december': 12
    }
    # Vietnamese: "Ngay DD thang MM nam YYYY"
    m = re.search(r'[Nn]g[a\u00e0]y\s+(\d{1,2})\s+th[a\u00e1]ng\s+(\d{1,2})\s+n[a\u0103][mn]\s+(\d{4})', text)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    # DD/MM/YYYY
    m = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', text)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    # "14th May, 2026"
    m = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9}),?\s+(\d{4})', text, re.IGNORECASE)
    if m:
        d, mon, y = m.groups()
        mo = months.get(mon.lower(), months.get(mon.lower()[:3], 1))
        return f"{y}-{mo:02d}-{int(d):02d}"
    return None


# ---------------------------------------------------------------------------
# Main extractor
# ---------------------------------------------------------------------------

def client_extract(file_bytes: bytes) -> dict:
    """
    Trich xuat thong tin bao gia tu file PDF Timtex gui cho khach hang.
    Returns dict voi invoice_type = "client" (cung format voi supplier invoice).
    """
    pdf_file = io.BytesIO(file_bytes)
    pages_text = []
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            pages_text.append(page.extract_text() or "")

    full_text = "\n".join(pages_text)
    page1_text = pages_text[0] if pages_text else ""

    if "TIMTEX TRADING CO" not in full_text.upper():
        raise ValueError("Khong tim thay header TIMTEX TRADING CO.")

    data = {
        "invoice_type": "client",
        "invoice_code": None,
        "client_id": None,
        "client_name": None,
        "date": None,
        "total_amount_CIF": 0.0,
        "clients_pdf_file_path": None,
        "status": "verified",
        "payment_method": "no info",
        "currency": detect_currency(full_text),
        "items": [],
        "customFields": "[]",
    }

    # 1. Ma bao gia – chap nhan khoang trang trong "So/No : ZRCY001"
    code_patterns = [
        r'[Ss][o\u1ed1]/No\s*[:.]\s*([A-Za-z0-9\-_/.]+)',   # So/No: hoac So/No :
        r'[Ss]\u1ed1[:.]\s*([A-Za-z0-9\-_/.]+)',              # So: (khong co /No)
        r'Ref\s*No#?[:\s]+([A-Za-z0-9\-_]+)',                  # Ref No#:
        r'^No\.\s+([A-Za-z0-9\-_]+)\s*$',                     # No. 219202 standalone
    ]
    for pat in code_patterns:
        m = re.search(pat, page1_text, re.IGNORECASE | re.MULTILINE)
        if m:
            raw = m.group(1).strip().rstrip('.,').split()[0]
            # Loai bo neu chi la so nha (1-3 chu so)
            if not re.match(r'^\d{1,3}$', raw) and len(raw) >= 3:
                data["invoice_code"] = raw
                break

    # 2. Ten khach hang – lay dong dau tien, cat phan So/No va Date
    client_m = re.search(
        r'(?:Messr[s]?:|K\u00ednh g\u1eedi:|Dear:|Attn\s+to:)\s*(.+?)(?:\n|Inquiry|$)',
        page1_text, re.IGNORECASE | re.DOTALL
    )
    if client_m:
        raw_client = client_m.group(1).strip().split('\n')[0].strip()
        # Cat phan So/No, Date cuoi ten
        raw_client = re.sub(r'\s+[Ss][o\u1ed1]/No.*$', '', raw_client, flags=re.IGNORECASE).strip()
        raw_client = re.sub(r'\s+[Nn]g[a\u00e0]y[:\s].*$', '', raw_client).strip()
        raw_client = re.sub(r'\s+Date[:\s].*$', '', raw_client, flags=re.IGNORECASE).strip()
        raw_client = re.sub(r'\s+TAX\s+CODE.*$', '', raw_client, flags=re.IGNORECASE).strip()
        if raw_client and len(raw_client) > 2:
            data["client_name"] = raw_client

    # 3. Ngay
    data["date"] = parse_date_vn(page1_text)

    # 4. Phuong thuc thanh toan
    pay_m = re.search(
        r'(?:Payment\s+term|Dieu\s+khoan\s+thanh\s+toan|'
        r'Phuong\s+thuc\s+thanh\s+toan|Ph\u01b0\u01a1ng\s+th\u1ee9c\s+thanh\s+to\u00e1n|'
        r'\u0110i\u1ec1u\s+kho\u1ea3n\s+thanh\s+to\u00e1n)[:/\s]+([^\n\r]+)',
        full_text, re.IGNORECASE
    )
    if pay_m:
        raw_pay = pay_m.group(1).strip()
        if '/' in raw_pay:
            raw_pay = raw_pay.split('/')[0].strip()
        data["payment_method"] = raw_pay[:200]

    # 5. Tong tien – nhieu format khac nhau
    total_patterns = [
        r'TOTAL\s+CIF\s+HCM(?:\s+VALUE)?[^\d\n]*?([\d,.]+)',
        r'T\u1ed4NG\s+GI\u00c1\s+TR\u1eca\s+CIF\s+HCM[^\d\n]*?([\d,.]+)',
        r'Grand\s+Total\s+CIF[^\d\n]*?([\d,.]+)',
        r'TOTAL\s+VALUE\s+CIF\s+HO\s+CHI\s+MINH[^\d\n]*?([\d,.]+)',
        r'Total\s+CIF\s+Hai\s+Phong[^\d\n]*?([\d,.]+)',
        r'Total\s+CIF\s+HCM[^\d\n]*?([\d,.]+)',
        r'TOTAL\s+FOB\s+(?:CHINA|MUMBAI)?[^\d\n]*?USD?\s*([\d,.]+)',
        r'Total\s+value\s+DAP\s+Viet\s+Nam[^\d\n]*?([\d,.]+)',
        r'CIF\s+SEA\s+HCMC[^\d\n]*?USD?\s*([\d,.]+)',
        r'GI\u00c1\s+FOB\s+MUMBAI[^\d\n]*?USD?\s*([\d,.]+)',
        r'T\u1ed4NG\s+GI\u00c1\s+TR\u1eca\s+CIF\s+H\u1ed2\s+CH\u00cd\s+MINH[^\d\n]*?USD?\s*([\d,.]+)',
    ]
    for pat in total_patterns:
        m = re.search(pat, full_text, re.IGNORECASE)
        if m:
            val_str = re.sub(r'[\xa5\u20ac$\s]', '', m.group(1))
            parsed = parse_price(val_str)
            if parsed > 0:
                data["total_amount_CIF"] = parsed
                break

    # 6. Loai bao gia
    machine_mode = is_machine_invoice(full_text)

    # 7. Trich xuat items
    if machine_mode:
        data["items"] = _extract_machine_items(full_text, page1_text)
    else:
        data["items"] = _extract_parts_items(full_text, pages_text)

    # 8. Tim / tao client trong DB
    if data["client_name"]:
        data["client_id"] = get_or_create_client(data["client_name"])

    return data


# ---------------------------------------------------------------------------
# Parts items extractor
# ---------------------------------------------------------------------------

def _extract_parts_items(full_text: str, pages_text: list) -> list:
    """
    Trich xuat items linh kien. Ho tro COMBINE (nhieu INQ separator).
    Items co the co '$' trong gia – strip truoc khi match.
    """
    items = []
    current_inquiry = None

    stop_kws = [
        'TOTAL CIF', 'T\u1ed4NG GI\u00c1', 'TOTAL FOB', 'TOTAL GOODS',
        'TERMS AND', 'C\u00c1C \u0110I\u1ec0U KHO\u1ea2N', 'PACKING CHARGES',
        'TRANSPORTATION', 'INSURANCE', 'GI\u00c1 FOB MUMBAI',
        'TOTAL VALUE', 'PH\u00cd V\u1eacN CHUY\u1ec2N', 'PH\u00cd B\u1ea2O HI\u1ec2M',
        'SUPPLIER /', 'PAGE |', 'PAGE 1',
        'T\u1ed4NG TI\u1ec0N H\u00c0NG', 'CHI PH\u00cd', 'PH\u00cd B\u1ea2O',
    ]

    for page_text in pages_text:
        lines = page_text.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            # Separator inquiry (e.g. "INQ Q100026P034")
            inq_m = re.match(r'^(?:INQ\s+)?([A-Z]\d{5,}[A-Z]\d+)\s*$', line)
            if inq_m:
                inq_code = inq_m.group(1)
                if inq_code != current_inquiry:
                    current_inquiry = inq_code
                    items.append({
                        "product_code": inq_code,
                        "base_price": 0.0,
                        "quantity": 0.0,
                        "note": "",
                        "extra_data": {"type": "inquiry_separator"},
                        "customFields": "[]",
                    })
                i += 1
                continue

            # Dung neu gap TOTAL / TERMS
            upper = line.upper()
            if any(kw in upper for kw in stop_kws):
                i += 1
                continue

            # Strip $ truoc khi parse
            clean = re.sub(r'\$\s*', '', line)

            # Pattern 6-token: STT code desc qty price amount
            m6 = re.match(
                r'^(\d{1,3})\s+([^\s]+)\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$',
                clean
            )
            if m6:
                _stt, code, desc, qty_r, price_r, amount_r = m6.groups()
                if not any(kw in desc.upper() for kw in ['TOTAL', 'T\u1ed4NG']):
                    items.append({
                        "product_code": code,
                        "base_price": parse_price(price_r),
                        "quantity": parse_qty(qty_r),
                        "note": desc.strip(),
                        "extra_data": {"amount": parse_price(amount_r)},
                        "customFields": "[]",
                    })
                i += 1
                continue

            # Pattern 5-token: STT desc qty price amount
            m5 = re.match(
                r'^(\d{1,3})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$',
                clean
            )
            if m5:
                _stt, desc, qty_r, price_r, amount_r = m5.groups()
                if any(kw in desc.upper() for kw in ['TOTAL', 'T\u1ed4NG', 'SUBTOTAL']):
                    i += 1
                    continue
                parts = desc.strip().split()
                code = parts[0] if parts else desc
                note = ' '.join(parts[1:]) if len(parts) > 1 else ''
                items.append({
                    "product_code": code,
                    "base_price": parse_price(price_r),
                    "quantity": parse_qty(qty_r),
                    "note": note,
                    "extra_data": {"amount": parse_price(amount_r)},
                    "customFields": "[]",
                })
                i += 1
                continue

            # Pattern 4-token: STT desc qty price
            m4 = re.match(
                r'^(\d{1,3})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$',
                clean
            )
            if m4:
                _stt, desc, qty_r, price_r = m4.groups()
                if any(kw in desc.upper() for kw in ['TOTAL', 'T\u1ed4NG']):
                    i += 1
                    continue
                parts = desc.strip().split()
                code = parts[0] if parts else desc
                note = ' '.join(parts[1:]) if len(parts) > 1 else ''
                items.append({
                    "product_code": code,
                    "base_price": parse_price(price_r),
                    "quantity": parse_qty(qty_r),
                    "note": note,
                    "extra_data": {},
                    "customFields": "[]",
                })
                i += 1
                continue

            i += 1

    return items


# ---------------------------------------------------------------------------
# Machine items extractor
# ---------------------------------------------------------------------------

def _extract_machine_items(full_text: str, page1_text: str) -> list:
    """
    Trich xuat items may chinh. Bo spec ky thuat chi giu may.
    """
    items = []
    lines = page1_text.split('\n')

    # Tim header bang
    header_idx = -1
    for idx, line in enumerate(lines):
        upper = line.upper()
        has_desc = any(k in upper for k in ['DESCRIPTION', 'M\u00d4 T\u1ea2', 'NAME', 'T\u00caN', 'ITEM'])
        has_qty = any(k in upper for k in ['QUANTITY', 'S\u1ed0 L\u01af\u1ee3NG', 'QTY'])
        has_price = any(k in upper for k in ['PRICE', 'GI\u00c1', 'UNIT', '\u0110\u01a0N GI\u00c1'])
        if has_desc and has_qty and has_price:
            header_idx = idx
            break

    if header_idx == -1:
        for idx, line in enumerate(lines):
            if re.match(r'^[A-Z1-9]\s+.{5,}\s+\d+\s+[\d,]+', line):
                header_idx = idx - 1
                break

    if header_idx == -1:
        return items

    stop_keywords = [
        'TOTAL CIF', 'T\u1ed4NG GI\u00c1', 'TERMS AND', 'C\u00c1C \u0110I\u1ec0U KHO\u1ea2N',
        'MAKER', 'NH\u00c0 S\u1ea2N XU\u1ea4T', 'DELIVERY', 'PAYMENT', 'OFFER',
    ]

    for idx in range(header_idx + 1, len(lines)):
        line = lines[idx].strip()
        if not line:
            continue
        upper = line.upper()
        if any(kw in upper for kw in stop_keywords):
            break

        clean = re.sub(r'\$\s*', '', line)

        m = re.match(
            r'^([A-Za-z]|\d+)\s+(.+?)\s+([\d,]+)\s+([\d,.]+)\s+([\d,.]+)$',
            clean
        )
        if m:
            label, desc_raw, qty_r, price_r, amount_r = m.groups()
            qty = parse_qty(qty_r)
            price = parse_price(price_r)
            amount = parse_price(amount_r)
            desc_parts = desc_raw.strip().split()
            model_parts = [p for p in desc_parts if re.match(r'^[A-Za-z0-9\-/]+$', p)]
            model = ' '.join(model_parts[:3]) if model_parts else desc_parts[0]
            items.append({
                "product_code": model,
                "base_price": price,
                "quantity": qty,
                "note": desc_raw.strip(),
                "extra_data": {"amount": amount, "item_label": label},
                "customFields": "[]",
            })
            continue

        m2 = re.match(
            r'^([A-Za-z]|\d+)\s+(.+?)\s+([\d,]+)\s+([\d,.]+)$',
            clean
        )
        if m2:
            label, desc_raw, qty_r, price_r = m2.groups()
            qty = parse_qty(qty_r)
            price = parse_price(price_r)
            desc_parts = desc_raw.strip().split()
            model_parts = [p for p in desc_parts if re.match(r'^[A-Za-z0-9\-/]+$', p)]
            model = ' '.join(model_parts[:3]) if model_parts else desc_parts[0]
            items.append({
                "product_code": model,
                "base_price": price,
                "quantity": qty,
                "note": desc_raw.strip(),
                "extra_data": {"item_label": label},
                "customFields": "[]",
            })

    return items

