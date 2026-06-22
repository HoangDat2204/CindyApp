import pdfplumber
import os
import json
from datetime import datetime
from bs4 import BeautifulSoup
import io

# ==========================================
# PHẦN 1: BÓC TÁCH TỪ TEXT & HTML SANG JSON (SẼ CẬP NHẬT TIẾP)
# ==========================================
import re
from bs4 import BeautifulSoup
from datetime import datetime

# ==========================================
# PHẦN 1: BÓC TÁCH TỪ TEXT & HTML SANG JSON 
# ==========================================
import re
from bs4 import BeautifulSoup

# ==========================================
# PHẦN 1: BÓC TÁCH TỪ TEXT & HTML SANG JSON (DYNAMIC MAPPING)
# ==========================================
def parse_html_table_to_grid(table_soup):
    """
    Thuật toán phân tích bảng HTML (có chứa rowspan/colspan) thành mảng 2D hoàn chỉnh.
    Giúp các ô bị gộp được dàn trải đều để dễ dàng lấy tiêu đề cột.
    """
    rows = table_soup.find_all('tr')
    grid = {} 
    max_col = 0
    
    for r_idx, row in enumerate(rows):
        cells = row.find_all(['td', 'th'])
        c_idx = 0
        for cell in cells:
            # Tìm vị trí cột còn trống trong hàng hiện tại
            while grid.get((r_idx, c_idx)) is not None:
                c_idx += 1
                
            rowspan = int(cell.get('rowspan', 1))
            colspan = int(cell.get('colspan', 1))
            
            # Thay <br> bằng khoảng trắng để chữ không dính liền nhau
            for br in cell.find_all("br"):
                br.replace_with(" ")
            text = cell.get_text(separator=" ", strip=True)
            
            # Lấp đầy các ô trong mảng 2D
            for i in range(rowspan):
                for j in range(colspan):
                    if grid.get((r_idx + i, c_idx + j)) is None:
                        grid[(r_idx + i, c_idx + j)] = text
                    if c_idx + j > max_col:
                        max_col = c_idx + j
            c_idx += colspan
            
    # Chuyển từ Dict tọa độ sang list 2D
    list_grid = []
    for r in range(len(rows)):
        row_data = []
        for c in range(max_col + 1):
            row_data.append(grid.get((r, c), ""))
        list_grid.append(row_data)
    return list_grid

import re
from bs4 import BeautifulSoup

def extract_invoice_to_json(full_text: str, html_content: str) -> dict:
    data = {
        "date_quotation": None,
        "quotation_id": None,
        "invoice_type": 'client',
        "client_name": "TỔNG CÔNG TY CỔ PHẦN PHONG PHÚ",
        # "supplier_name": None,
        "client_id": 1,                     
        "client_pdf_file_path": None,       
        "status": "pending", 
        "payment_method": None,
        "total_amount_CIF": None,
        "items": []
    }

    # 1. BẮT CÁC THÔNG TIN CHUNG TỪ FULL TEXT (REGEX)
    date_match = re.search(r"Ngày\s+(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s+(\d{4})", full_text, re.IGNORECASE)
    if date_match:
        day, month, year = date_match.groups()
        data["date_quotation"] = f"{year}-{int(month):02d}-{int(day):02d}"

        
    quote_match = re.search(r"Số\s*/\s*No:?\s*(.*?)(?=\n|$)", full_text, re.IGNORECASE)
    if quote_match:
        data["quotation_id"] = quote_match.group(1).strip()

    def safe_float(val):
        if not val: return None
        val = str(val).strip().strip("$").replace(',', '')
        try: return float(val)
        except ValueError: return None

    # Hàm chuyển đổi HTML table sang ma trận 2D xử lý rowspan/colspan
    def parse_html_table_to_grid(table):
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

    # 2. XỬ LÝ HTML ĐỂ BẮT ITEM VÀ CÁC THÔNG TIN THANH TOÁN
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Bắt Payment Method và CIF toàn cục
    for row in soup.find_all('tr'):
        row_text_upper = row.get_text(separator=" ", strip=True).upper()
        cells = row.find_all(['td', 'th'])
        if not cells: continue
        
        if "PAYMENT TERM" in row_text_upper or "PHƯƠNG THỨC THANH TOÁN" in row_text_upper:
            for br in cells[-1].find_all("br"): br.replace_with("\n")
            data["payment_method"] = cells[-1].get_text(strip=True)
            
        if "TỔNG GIÁ TRỊ CIF" in row_text_upper or "CIF SEA" in row_text_upper:
            data["total_amount_CIF"] = safe_float(cells[-1].get_text(strip=True))
      
    # Quét từng bảng để lấy dữ liệu Items
    for table_soup in soup.find_all('table'):
        grid = parse_html_table_to_grid(table_soup)
        if not grid: continue
        
        # A. Xác định dòng bắt đầu của dữ liệu
        first_data_row_idx = -1
        for r_idx, row in enumerate(grid):
            if row and row[0] and str(row[0]).split('.')[0].strip().isdigit():
                first_data_row_idx = r_idx
                break
                
        if first_data_row_idx == -1:
            continue

        # B. Tự động sinh tên cột
        num_cols = len(grid[0])
        headers = []
        for c in range(num_cols):
            col_parts = []
            for r in range(first_data_row_idx):
                val = grid[r][c].replace("\n", " ").strip()
                if val and val not in col_parts:
                    col_parts.append(val)
            header_name = " - ".join(col_parts) if col_parts else f"Column_{c}"
            headers.append(header_name)
            
        # C. Xác định vai trò của từng cột dựa trên từ khóa
        col_mapping = {}
        for idx, h_name in enumerate(headers):
            h_upper = h_name.upper()
            if any(k in h_upper for k in ["MÃ SẢN PHẨM", "PRODUCT CODE", "QUALITY", "MÃ HÀNG", "MÔ TẢ"]):
                col_mapping[idx] = "product_code"
            elif any(k in h_upper for k in ["SỐ LƯỢNG", "QTY", "QUANTITY"]):
                col_mapping[idx] = "quantity"
            elif any(k in h_upper for k in ["ĐƠN GIÁ", "UNIT PRICE", "PRICE", "BASE PRICE"]):
                col_mapping[idx] = "base_price"
            elif any(k in h_upper for k in ["STT", "SR", "NO."]) and not "MÃ" in h_upper:
                col_mapping[idx] = "ignore"
            else:
                col_mapping[idx] = "extra"

        # Rào chắn: Bỏ qua bảng nếu không khớp cấu trúc bảng sản phẩm
        has_product_code = any(role == "product_code" for role in col_mapping.values())
        has_qty_or_price = any(role in ["quantity", "base_price"] for role in col_mapping.values())
        if not (has_product_code and has_qty_or_price):
            continue

        # D. Duyệt từng dòng dữ liệu và Ghi chú
        current_item = None
        for r_idx in range(first_data_row_idx, len(grid)):
            row = grid[r_idx]
            row_text_upper = " ".join([str(x).upper() for x in row if x]).strip()
            
            # Điểm dừng: Gặp Footer (Khối lượng, FOB, CIF...). Dùng break thay vì continue để ngắt hẳn việc đọc rác.
            if any(kw in row_text_upper for kw in ["KHỐI LƯỢNG", "WEIGHT", "FOB", "FREIGHT", "INSURANCE", "CIF", "TỔNG GIÁ TRỊ"]):
                break

            cell_0 = str(row[0]).strip() if row[0] else ""
            
            # Nếu là dòng chứa SẢN PHẨM MỚI
            if cell_0.split('.')[0].isdigit():
                item = {
                    "product_code": None,
                    "note": None,
                    "quantity": None,
                    "base_price": None,
                    "extra_data": {}
                }
                
                for c_idx, cell_val in enumerate(row):
                    if not cell_val: continue
                    val_str = str(cell_val).strip()
                    role = col_mapping.get(c_idx, "extra")
                    
                    if role == "product_code" and not item["product_code"]:
                        item["product_code"] = val_str
                    elif role == "quantity" and item["quantity"] is None:
                        item["quantity"] = safe_float(val_str)
                    elif role == "base_price" and item["base_price"] is None:
                        item["base_price"] = safe_float(val_str)
                    elif role == "extra":
                        item["extra_data"][headers[c_idx].rsplit('-', 1)[-1]] = val_str
                    print(item)
                data["items"].append(item)
                current_item = item
                
            # Nếu là dòng GHI CHÚ dưới sản phẩm
            else:
                if current_item is not None:
                    unique_texts = []
                    for cell_val in row:
                        val_str = str(cell_val).strip()
                        if val_str and val_str not in unique_texts:
                            unique_texts.append(val_str)
                            
                    note_text = " ".join(unique_texts).strip()
                    if note_text and "SR. NO." not in note_text.upper() and "QUALITY" not in note_text.upper():
                        if current_item["note"]:
                            current_item["note"] += "\n" + note_text
                        else:
                            current_item["note"] = note_text

    # 3. LỌC CUỐI CÙNG: Loại bỏ ngay các items thiếu một trong ba trường bắt buộc
    data["items"] = [
        item for item in data["items"]
        if item.get("product_code") is not None 
        and item.get("quantity") is not None 
        and item.get("base_price") is not None
    ]

    return data


# ==========================================
# PHẦN 2: ĐỌC PDF, LẤY TOÀN BỘ TEXT VÀ XUẤT BẢNG RA HTML
# ==========================================
def cell(value):
    """Làm sạch dữ liệu text trong ô."""
    if value is None:
        return ""
    text = str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text.replace("\n", "<br>")

def table_to_html(table: list[list]) -> str:
    """Thuật toán chuyển mảng 2D của pdfplumber thành HTML Table."""
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

def process_invoice(pdf_file) -> tuple[str, list[str]]:
    """
    Quét PDF và trả về 2 phần:
    1. full_text: Toàn bộ chữ có trong PDF.
    2. extracted_html: Danh sách các bảng đã được convert sang dạng HTML.
    """
    extracted_html = []
    full_text = ""
    
    table_settings = {
        "vertical_strategy": "lines", 
        "horizontal_strategy": "lines",
        "intersection_tolerance": 15
    }

    with pdfplumber.open(pdf_file) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            print(f"  -> Scanning page {page_num}...")
            
            # --- 1. LẤY TOÀN BỘ TEXT CỦA TRANG ---
            page_text = page.extract_text()
            if page_text:
                full_text += page_text + "\n"
                
            # --- 2. LẤY TOÀN BỘ BẢNG CHUYỂN SANG HTML ---
            tables = page.extract_tables(table_settings)
            print(f"     Found {len(tables)} table(s)")

            for table_idx, table in enumerate(tables, start=1):
                print(f"     Table {table_idx}: {len(table)} rows × {len(table[0])} cols")
                html = table_to_html(table)
                extracted_html.append(html)

    return full_text, extracted_html


# ==========================================
# PHẦN 3: HÀM CHẠY CHÍNH (MAIN)
# ==========================================
def Phong_Phu_extract(file_bytes: bytes, supplier_name:str) -> dict:
    """
    Xử lý trực tiếp file PDF dạng bytes từ API.
    Bây giờ truyền cả Text thô và HTML Table vào hàm bóc tách.
    """
    # Bước 0: Biến file_bytes trong RAM thành đối tượng giống-như-file
    pdf_file_obj = io.BytesIO(file_bytes)

    # Bước 1: Quét PDF ra 2 loại dữ liệu: Chữ toàn file và Mảng HTML các bảng
    full_text, tables_html = process_invoice(pdf_file_obj) 

    # Nối tất cả các bảng tìm được thành 1 cục HTML duy nhất
    combined_html = "\n<br>\n".join(tables_html)

    if full_text or combined_html:
        # Bước 2: Bóc tách dữ liệu JSON dựa trên cả 2 nguồn (Text thô và HTML bảng)
        result_json = extract_invoice_to_json(full_text, combined_html)
        # result_json["supplier_name"] = supplier_name
        # Bước 3: TRẢ VỀ giá trị để API hứng được
        return result_json
    else:
        # Bắn lỗi nếu PDF hoàn toàn trống
        raise ValueError("Không tìm thấy nội dung Text hoặc Bảng nào trong file PDF được tải lên.")