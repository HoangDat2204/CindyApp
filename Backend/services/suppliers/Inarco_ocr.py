"""
PDF Invoice Table Extractor (Ultimate Version)
==============================================
Tích hợp pdfplumber, thuật toán sinh HTML gộp ô và BeautifulSoup để bóc tách JSON.
Yêu cầu cài đặt: pip install pdfplumber beautifulsoup4
"""

import pdfplumber
import os
import json
import re
from datetime import datetime
from bs4 import BeautifulSoup
import io
def parse_date(raw_date: str) -> str:
    raw_date = raw_date.strip()
    # Normalize separators
    normalized = raw_date.replace("/", "-").replace(".", "-")
    
    # Try to parse numeric formats like 24-03-2026 or 24-3-2026
    parts = normalized.split("-")
    if len(parts) == 3:
        # Check if it's YYYY-MM-DD
        if len(parts[0]) == 4 and parts[1].isdigit() and parts[2].isdigit():
            try:
                dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
        # Check if it's DD-MM-YYYY or DD-MM-YY
        elif parts[0].isdigit() and parts[1].isdigit():
            day = int(parts[0])
            month = int(parts[1])
            year_str = parts[2]
            if len(year_str) == 2:
                year = 2000 + int(year_str)
            elif len(year_str) == 4:
                year = int(year_str)
            else:
                year = 2000
            try:
                dt = datetime(year, month, day)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
                
        # Check if it has a month name (e.g. 15-May-2026 or 15-May-26)
        day_str, month_str, year_str = parts[0], parts[1], parts[2]
        months_map = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
        }
        month_key = month_str[:3].lower()
        if day_str.isdigit() and month_key in months_map:
            day = int(day_str)
            month = months_map[month_key]
            if len(year_str) == 2:
                year = 2000 + int(year_str)
            elif len(year_str) == 4:
                year = int(year_str)
            else:
                year = 2000
            try:
                dt = datetime(year, month, day)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Fallback to direct strptime
    for fmt in ("%d-%b-%Y", "%d-%b-%y", "%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d"):
        try:
            parsed_date = datetime.strptime(raw_date, fmt)
            return parsed_date.strftime("%Y-%m-%d")
        except ValueError:
            continue
            
    return raw_date

# ==========================================
# PHẦN 1: BÓC TÁCH TỪ HTML SANG JSON (BEAUTIFULSOUP)
# ==========================================
# ==========================================
# PHẦN 1: BÓC TÁCH TỪ HTML SANG JSON (BEAUTIFULSOUP)
# ==========================================
def extract_invoice_to_json(html_content: str) -> dict:
    """
    Hàm bóc tách dữ liệu JSON từ chuỗi HTML đã được xử lý rowspan/colspan.
    Nâng cấp: Lấy giá CIF, Payment Method và bóc tách Items linh động dựa trên Tên Cột.
    Bổ sung: Lọc bỏ các items thiếu các trường quan trọng (product_code, quantity, base_price).
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    rows = soup.find_all('tr')

    # Tìm danh sách mã Inquiry bằng regex linh hoạt hỗ trợ ngắt dòng/HTML (không phân biệt hoa thường)
    raw_matches = re.findall(r'[qQ]\s*(?:<br\/?>)?\s*\d+\s*(?:<br\/?>)?\s*[pP]\s*(?:<br\/?>)?\s*\d+', html_content)
    inquiry_numbers = []
    for m in raw_matches:
        clean_num = re.sub(r'[\s<br/>]', '', m).upper()
        if clean_num not in inquiry_numbers:
            inquiry_numbers.append(clean_num)

    # Định nghĩa sẵn cấu trúc JSON trả về (khớp với schemas.py mới)
    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 1,
        "supplier_name": "Inarco",
        # "client": None,         
        "date": None,
        "suppliers_pdf_file_path": None,
        "status": "verified",
        "total_amount_CIF": None,
        "payment_method": None,
        "items": []
    }

    def safe_float(val):
        if not val: return None
        clean_val = str(val).strip().replace(',', '')
        try:
            return float(clean_val)
        except ValueError:
            return None

    def extract_float(val):
        if not val: return None
        clean_val = str(val).strip().replace(',', '')
        try:
            return float(clean_val)
        except ValueError:
            m = re.findall(r'[\d,]+(?:\.\d+)?', str(val))
            if m:
                try:
                    return float(m[-1].replace(',', ''))
                except ValueError:
                    return None
            return None

    def safe_int(val):
        if not val: return None
        clean_val = str(val).strip().replace(',', '')
        try:
            return int(float(clean_val))
        except ValueError:
            return None

    # ---------------------------------------------------------
    # 1. Vòng lặp 1: Quét tìm thông tin chung (Header & Footer)
    # (Phần này vẫn giữ nguyên logic gốc dò tìm theo chiều ngang)
    # ---------------------------------------------------------
    for i, row in enumerate(rows):
        cells = row.find_all('td')
        
        for j, cell in enumerate(cells):
            text = cell.text.strip().upper() 
            
            if text == "TO:":
                if j + 1 < len(cells):
                    raw_client_name = cells[j+1].get_text(separator=" ", strip=True)
            
            if text == "QUOTE NO":
                if i + 1 < len(rows):
                    next_row_cells = rows[i+1].find_all('td')
                    if len(next_row_cells) > 2:
                        data["invoice_code"] = next_row_cells[1].text.strip()
                        raw_date = next_row_cells[2].text.strip()
                        data["date"] = parse_date(raw_date)

            if any(k in text for k in ["CIF", "CFR", "CIP"]): 
                price = None
                for next_cell in cells[j+1:]:
                    price = extract_float(next_cell.text)
                    if price is not None:
                        break
                if price is None:
                    price = extract_float(cell.text)
                if price is not None:
                    data["total_amount_CIF"] = price

            if text == "PAYMENT":
                if j + 1 < len(cells):
                    data["payment_method"] = cells[j+1].text.strip()

    # ---------------------------------------------------------
    # 2. Vòng lặp 2: Quét tìm Items và Ghi chú (Notes) LINH ĐỘNG
    # ---------------------------------------------------------
    # Hàm con: Phân tích bảng xử lý triệt để rowspan/colspan thành mảng 2D
    def parse_table_to_grid(table):
        table_rows = table.find_all('tr')
        grid = {}
        max_col = 0
        for r_idx, r in enumerate(table_rows):
            c_idx = 0
            for cell in r.find_all(['td', 'th']):
                while grid.get((r_idx, c_idx)) is not None:
                    c_idx += 1
                rowspan = int(cell.get('rowspan', 1))
                colspan = int(cell.get('colspan', 1))
                
                # Giữ khoảng trắng thay vì dính chữ
                for br in cell.find_all("br"):
                    br.replace_with(" ")
                text_val = cell.get_text(separator=" ", strip=True)
                
                for i_r in range(rowspan):
                    for j_c in range(colspan):
                        if grid.get((r_idx + i_r, c_idx + j_c)) is None:
                            grid[(r_idx + i_r, c_idx + j_c)] = text_val
                        if c_idx + j_c > max_col:
                            max_col = c_idx + j_c
                c_idx += colspan
        
        list_grid = []
        for r in range(len(table_rows)):
            list_grid.append([grid.get((r, c), "") for c in range(max_col + 1)])
        return list_grid

    # Chạy xử lý trên từng bảng HTML
    for table in soup.find_all('table'):
        grid = parse_table_to_grid(table)
        if not grid:
            continue
            
        # Tìm dòng đầu tiên có chứa dữ liệu Item (Cột đầu tiên bắt đầu bằng số thứ tự)
        first_item_idx = -1
        for r_idx, row in enumerate(grid):
            if row and row[0] and str(row[0]).strip().split('.')[0].isdigit():
                first_item_idx = r_idx
                break
                
        if first_item_idx == -1:
            continue # Bảng này không chứa list Items

        # Tạo tự động Tên Cột bằng cách gộp các dòng tiêu đề bên trên Item đầu tiên
        num_cols = len(grid[0])
        headers = []
        for c in range(num_cols):
            col_parts = []
            for r in range(first_item_idx):
                val = grid[r][c].replace("\n", " ").strip()
                if val and val not in col_parts:
                    # Bỏ qua các dòng chứa Inquiry No để tránh làm bẩn header của cột
                    if re.search(r'\b[qQ]\d+[pP]\d+\b', val):
                        continue
                    col_parts.append(val)
            header_name = " - ".join(col_parts) if col_parts else f"Column_{c}"
            
            # --- RÚT GỌN TÊN CỘT THEO YÊU CẦU ---
            header_upper = header_name.upper()
            if "BRD" in header_upper and "ID" in header_upper:
                header_name = "BRD-ID"
            elif "FOD" in header_upper and "WIDTH" in header_upper:
                header_name = "FOD-WIDTH"
            elif "WIDTH" in header_upper and "WALL" in header_upper:
                header_name = "WIDTH-WALL"
            elif "SPECIAL PROCESS" in header_upper:
                header_name = "SPECIAL PROCESS"
            elif "HARDNESS" in header_upper:
                header_name = "HARDNESS"
            elif "TOTAL USD" in header_upper:
                header_name = "TOTAL USD"
            elif "NET WEIGHT" in header_upper:
                header_name = "NET WEIGHT KGS"
            elif "GROSS WEIGHT" in header_upper:
                header_name = "GROSS WEIGHT KGS"
            elif "USD USD" in header_upper or header_upper.endswith(" - USD") or header_upper.endswith(" USD"):
                header_name = "USD USD"
                
            headers.append(header_name)

        # Map Cột (Chỉ định rõ cột nào mang ý nghĩa gì thông qua Keyword)
        col_mapping = {}
        for idx, h_name in enumerate(headers):
            h_upper = h_name.upper()
            if any(k in h_upper for k in ["MÃ SẢN PHẨM", "PRODUCT CODE", "QUALITY", "MÃ HÀNG"]):
                col_mapping[idx] = "product_code"
            elif any(k in h_upper for k in ["SỐ LƯỢNG", "QTY", "QUANTITY"]):
                col_mapping[idx] = "quantity"
            elif any(k in h_upper for k in ["ĐƠN GIÁ", "UNIT PRICE", "PRICE", "BASE PRICE"]):
                col_mapping[idx] = "base_price"
            elif any(k in h_upper for k in ["STT", "SR", "NO."]) and "MÃ" not in h_upper:
                col_mapping[idx] = "ignore" # Bỏ qua cột STT để không đưa vào extra_data
            else:
                col_mapping[idx] = "extra"  # Bất kỳ cột nào không quy định sẽ vào extra_data

        current_item = None
        
        # Bắt đầu quét từ dòng 0 đến hết bảng
        for r_idx in range(0, len(grid)):
            row = grid[r_idx]
            row_text_upper = " ".join([str(x).upper() for x in row if x]).strip()
            
            # Điểm dừng an toàn
            if "TERMS & CONDITION" in row_text_upper:
                break
                
            cell_0 = str(row[0]).strip() if row else ""
            is_digit_start = cell_0.split('.')[0].isdigit()

            # Kiểm tra xem dòng này có chứa Inquiry No hay không (Case B)
            inquiry_match = None
            if not is_digit_start:
                # Ghép các giá trị ô duy nhất theo thứ tự để tránh bị lặp do colspan và tránh ngắt quãng
                seen_vals = set()
                unique_ordered = []
                for c in row:
                    if c and str(c).strip() != "":
                        val = str(c).strip().upper()
                        if val not in seen_vals:
                            seen_vals.add(val)
                            unique_ordered.append(val)
                unique_text = "".join(unique_ordered)
                
                if len(unique_text) < 35:
                    for num in inquiry_numbers:
                        if num in unique_text:
                            inquiry_match = num
                            break
            
            if inquiry_match:
                # Tạo dummy item để ngăn cách các phần
                item = {
                    "product_code": inquiry_match,
                    "base_price": 0.0,
                    "quantity": 0,
                    "note": None,
                    "extra_data": {}
                }
                data["items"].append(item)
                current_item = None
                continue
                
            if r_idx < first_item_idx:
                continue
            
            if cell_0.split('.')[0].isdigit():
                # ----- ĐÂY LÀ DÒNG CHỨA ITEM CHÍNH -----
                item = {
                    "product_code": None,
                    "base_price": None,
                    "quantity": None,
                    "note": None,
                    "extra_data": {}
                }
                
                for c_idx, cell_val in enumerate(row):
                    if not cell_val:
                        continue
                        
                    val_str = str(cell_val).strip()
                    role = col_mapping.get(c_idx, "extra")
                    
                    if role == "product_code" and not item["product_code"]:
                        item["product_code"] = val_str
                    elif role == "quantity" and item["quantity"] is None:
                        item["quantity"] = safe_int(val_str)
                    elif role == "base_price" and item["base_price"] is None:
                        item["base_price"] = safe_float(val_str)
                    elif role == "extra":
                        # Chèn tự động dữ liệu lạ vào extra theo Tên Cột thực tế
                        header_key = headers[c_idx] if c_idx < len(headers) else f"Column_{c_idx}"
                        if header_key and val_str:
                            item["extra_data"][header_key] = val_str
                                
                data["items"].append(item)
                current_item = item  # Trỏ vết cho ghi chú dòng kế tiếp
                
            else:
                # ----- ĐÂY LÀ DÒNG GHI CHÚ (NOTE) BỔ SUNG CHO ITEM TRƯỚC ĐÓ -----
                if current_item is not None:
                    # Lọc bỏ các ô lặp lại do thẻ colspan sinh ra để ghi chú không bị duplicate
                    unique_texts = []
                    for cell_val in row:
                        val_str = str(cell_val).strip()
                        if val_str and val_str not in unique_texts:
                            unique_texts.append(val_str)
                            
                    row_note_text = " ".join(unique_texts).strip()
                    
                    if row_note_text:
                        if current_item["note"] is None:
                            current_item["note"] = row_note_text
                        else:
                            current_item["note"] += " " + row_note_text

    # ---------------------------------------------------------
    # 3. Bước lọc cuối cùng: Loại bỏ items thiếu thông tin bắt buộc
    # ---------------------------------------------------------
    data["items"] = [
        item for item in data["items"]
        if item.get("product_code") is not None and str(item.get("product_code")).strip() != ""
        and item.get("quantity") is not None
        and item.get("base_price") is not None
    ]

    return data

# ==========================================
# PHẦN 2: ĐỌC PDF VÀ XUẤT RA HTML
# ==========================================
def cell(value):
    """Làm sạch dữ liệu text trong ô."""
    if value is None:
        return ""
    text = str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text.replace("\n", "<br>")

def table_to_html(table: list[list]) -> str:
    """Thuật toán chuyển mảng 2D của pdfplumber thành HTML Table (Hỗ trợ Colspan/Rowspan)."""
    if not table or not table[0]:
        return "<table></table>"

    rows = len(table)
    cols = len(table[0])
    skip = [[False] * cols for _ in range(rows)]
    rows_html = []

    for r in range(rows):
        cells_html = []
        for c in range(cols):
            if skip[r][c]:
                continue

            colspan = 1
            while c + colspan < cols and table[r][c + colspan] is None:
                colspan += 1

            rowspan = 1
            while r + rowspan < rows:
                if all(table[r + rowspan][c + i] is None for i in range(colspan)):
                    rowspan += 1
                else:
                    break

            for rr in range(rowspan):
                for cc in range(colspan):
                    skip[r + rr][c + cc] = True

            attrs = ""
            if rowspan > 1: attrs += f" rowspan='{rowspan}'"
            if colspan > 1: attrs += f" colspan='{colspan}'"

            content = cell(table[r][c])
            cells_html.append(f"<td{attrs}>{content}</td>")

        rows_html.append(f"  <tr>{''.join(cells_html)}</tr>")

    return "<table border='1' cellpadding='4' cellspacing='0'>\n" + "\n".join(rows_html) + "\n</table>"

def process_invoice(pdf_file) -> list[str]:
    extracted_html = []
    table_settings = {
        "vertical_strategy": "lines", 
        "horizontal_strategy": "lines",
        "intersection_tolerance": 15
    }

    with pdfplumber.open(pdf_file) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            print(f"  -> Scanning page {page_num}...")
            tables = page.extract_tables(table_settings)
            print(f"     Found {len(tables)} table(s)")

            for table_idx, table in enumerate(tables, start=1):
                print(f"     Table {table_idx}: {len(table)} rows × {len(table[0])} cols")
                html = table_to_html(table)
                extracted_html.append(html)

    return extracted_html

def save_html(tables_html: list[str], output_path: str):
    body = "\n<br>\n".join(tables_html)
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Extracted Tables</title>
<style>
    body {{ font-family: Arial, sans-serif; padding: 20px; }}
    table {{ border-collapse: collapse; margin-bottom: 24px; font-size: 13px; width: 100%; }}
    td {{ border: 1px solid #000; padding: 6px 8px; vertical-align: top; }}
    th {{ background-color: #f2f2f2; font-weight: bold; text-align: center; }}
</style>
</head>
<body>
{body}
</body>
</html>"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\nSaved HTML preview to: {output_path}")


# ==========================================
# PHẦN 3: HÀM CHẠY CHÍNH (MAIN)
# ==========================================
def Inarco_extract(file_bytes: bytes) -> dict:
    """
    Xử lý trực tiếp file PDF dạng bytes từ API mà không cần lưu xuống ổ cứng.
    """
    # Bước 0: Biến file_bytes trong RAM thành một đối tượng giống-như-file
    pdf_file_obj = io.BytesIO(file_bytes)

    # Kiểm tra dòng INARCO PRIVATE LTD. hoặc INARCO ở header
    with pdfplumber.open(pdf_file_obj) as pdf:
        full_text = ""
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
        text_upper = full_text.upper()
        if "INARCO PRIVATE LTD." not in text_upper and "INARCO" not in text_upper:
            raise ValueError("Không tìm thấy dòng INARCO PRIVATE LTD. hoặc INARCO ở header.")

    pdf_file_obj.seek(0)

    # Bước 1: Quét PDF ra danh sách mã HTML
    # Truyền trực tiếp pdf_file_obj vào hàm process_invoice
    tables_html = process_invoice(pdf_file_obj) 

    # Bước 2: Lấy bảng đầu tiên đưa vào BeautifulSoup để lấy JSON
    if tables_html:
        first_table_html = tables_html[0]
        result_json = extract_invoice_to_json(first_table_html)
        
        # Bước 3: TRẢ VỀ giá trị để API hứng được
        return result_json
    else:
        # Bắn lỗi nếu PDF trống, API sẽ hứng lỗi này ở khối except Exception
        raise ValueError("Không tìm thấy bất kỳ bảng nào trong file PDF được tải lên.")