"""
PDF Invoice Table Extractor for Qingdao Everlasting Co., Ltd.
============================================================
Tích hợp pdfplumber, thuật toán sinh HTML gộp ô và BeautifulSoup để bóc tách JSON.
Yêu cầu cài đặt: pip install pdfplumber beautifulsoup4
"""

import pdfplumber
import os
import json
import re
import io
from datetime import datetime
from bs4 import BeautifulSoup

# ==========================================
# PHẦN 1: BÓC TÁCH TỪ HTML SANG JSON (BEAUTIFULSOUP)
# ==========================================
def extract_invoice_to_json(html_content: str, raw_text: str = "") -> dict:
    """
    Hàm bóc tách dữ liệu JSON từ chuỗi HTML đã được xử lý rowspan/colspan.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    rows = soup.find_all('tr')

    # Định nghĩa cấu trúc JSON trả về khớp với schema yêu cầu
    data = {
        "invoice_type": "supplier",
        "invoice_code": None,
        "supplier_id": 2,
        "supplier_name": "Qingdao Everlasting Co., Ltd.",
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

    def safe_int(val):
        if not val: return None
        clean_val = str(val).strip().replace(',', '')
        try:
            return int(float(clean_val))
        except ValueError:
            return None

    # 1. Trích xuất thông tin chung (Metadata) từ văn bản thuần túy
    if raw_text:
        ref_match = re.search(r'Ref:\s*([A-Z0-9\-]+)', raw_text, re.IGNORECASE)
        if ref_match:
            data["invoice_code"] = ref_match.group(1).strip()

        date_match = re.search(r'Date:\s*([A-Za-z]{3}\s+\d{1,2},\s*\d{4})', raw_text, re.IGNORECASE)
        if date_match:
            raw_date = date_match.group(1).strip()
            cleaned_date = re.sub(r'\s+', ' ', raw_date)
            try:
                parsed_date = datetime.strptime(cleaned_date, "%b %d, %Y")
                data["date"] = parsed_date.strftime("%Y-%m-%d")
            except ValueError:
                data["date"] = raw_date

        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        client_parts = []
        recording_client = False
        for line in lines:
            if "PROFORMA INVOICE" in line.upper():
                recording_client = True
                continue
            if "NAME OF COMMODITY" in line.upper() or "QUANTITY" in line.upper() or "UNIT PRICE" in line.upper():
                recording_client = False
                break
            if recording_client:
                clean_line = line
                if "REF:" in clean_line.upper():
                    ref_idx = clean_line.upper().find("REF:")
                    clean_line = clean_line[:ref_idx]
                if "DATE:" in clean_line.upper():
                    date_idx = clean_line.upper().find("DATE:")
                    clean_line = clean_line[:date_idx]
                
                clean_line = clean_line.strip()
                if clean_line.startswith("M/S."):
                    clean_line = clean_line[4:].strip()
                elif clean_line.startswith("M/S"):
                    clean_line = clean_line[3:].strip()
                    
                if clean_line:
                    client_parts.append(clean_line)
        # if client_parts:
        #     data["client"] = ", ".join(client_parts)

        payment_match = re.search(r'Payment term\s*[:：]?\s*([^\n]+)', raw_text, re.IGNORECASE)
        if payment_match:
            data["payment_method"] = payment_match.group(1).strip()

        cif_match = re.search(r'Total CIF [^0-9]*([\d,]+\.\d{2})', raw_text, re.IGNORECASE)
        if cif_match:
            data["total_amount_CIF"] = safe_float(cif_match.group(1))

    # Fallback trích xuất thủ công từ bảng HTML nếu văn bản thuần thiếu
    for i, row in enumerate(rows):
        cells = row.find_all('td')
        for j, cell in enumerate(cells):
            text = cell.text.strip().upper()
            # if not data["client"] and "M/S." in text:
            #     data["client"] = cell.text.replace("M/S.", "").strip()
            if not data["invoice_code"] and "REF:" in text:
                idx = text.find("REF:")
                data["invoice_code"] = cell.text[idx+4:].strip()
            if not data["total_amount_CIF"] and "TOTAL CIF" in text:
                for next_cell in cells[j+1:]:
                    val = safe_float(next_cell.text)
                    if val is not None:
                        data["total_amount_CIF"] = val
                        break

    # 2. Thuật toán gộp ô chuyển đổi bảng thành lưới 2D tọa độ thực
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

    grid = parse_table_to_grid(soup)
    if grid:
        headers = []
        first_item_idx = -1
        
        # Tìm tiêu đề cột đầu tiên
        for r_idx, row in enumerate(grid):
            # Làm sạch khoảng trắng của toàn bộ dòng để kiểm tra
            row_str_cleaned = "".join([str(x).upper() for x in row if x]).replace(" ", "")
            if "NAMEOFCOMMODITY" in row_str_cleaned or "QUANTITY" in row_str_cleaned:
                headers = [str(x).strip().replace('\n', ' ') for x in row]
                first_item_idx = r_idx + 1
                break
        
        if first_item_idx != -1 and headers:
            col_mapping = {}
            for idx, h_name in enumerate(headers):
                # Loại bỏ hoàn toàn khoảng trắng để chuẩn hóa việc so khớp tiêu đề cột
                h_clean = re.sub(r'\s+', '', h_name.upper())
                
                if any(k in h_clean for k in ["COMMODITY", "DESCRIPTION", "PRODUCTCODE", "ITEM", "MÃSẢNPHẨM", "MÃHÀNG"]):
                    col_mapping[idx] = "product_code"
                elif any(k in h_clean for k in ["SỐLƯỢNG", "QTY", "QUANTITY"]):
                    col_mapping[idx] = "quantity"
                elif any(k in h_clean for k in ["ĐƠNGIÁ", "UNITPRICE", "PRICE", "BASEPRICE"]):
                    col_mapping[idx] = "base_price"
                else:
                    col_mapping[idx] = "extra"

            # Tiến hành đọc các dòng dữ liệu sản phẩm
            for r_idx in range(first_item_idx, len(grid)):
                row = grid[r_idx]
                row_text_upper = " ".join([str(x).upper() for x in row if x]).strip()
                
                # Điểm dừng khi gặp dòng tổng tiền (Total CIF...)
                if "TOTAL" in row_text_upper or "CIF" in row_text_upper:
                    break
                    
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
                        header_key = headers[c_idx] if c_idx < len(headers) else f"Column_{c_idx}"
                        if header_key and val_str:
                            item["extra_data"][header_key] = val_str
                            
                if item["product_code"] and (item["quantity"] is not None or item["base_price"] is not None):
                    data["items"].append(item)

    # Lọc bỏ các dòng không hợp lệ
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
    if value is None:
        return ""
    text = str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text.replace("\n", "<br>")

def table_to_html(table: list[list]) -> str:
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

import pdfplumber
import io
import re

def cell(value):
    """Làm sạch và escape mã HTML trong từng ô của bảng."""
    if value is None:
        return ""
    text = str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text.replace("\n", "<br>")

def table_to_html(table_data: list[list]) -> str:
    """
    Chuyển đổi mảng 2D thô của bảng thành mã HTML <table> chuẩn.
    Thuật toán tự động tính toán rowspan và colspan dựa trên các ô bị gộp (None).
    """
    if not table_data or not table_data[0]:
        return "<table></table>"

    rows = len(table_data)
    cols = len(table_data[0])
    skip = [[False] * cols for _ in range(rows)]
    rows_html = []

    for r in range(rows):
        cells_html = []
        for c in range(cols):
            if skip[r][c]:
                continue

            colspan = 1
            while c + colspan < cols and table_data[r][c + colspan] is None:
                colspan += 1

            rowspan = 1
            while r + rowspan < rows:
                if all(table_data[r + rowspan][c + i] is None for i in range(colspan)):
                    rowspan += 1
                else:
                    break

            for rr in range(rowspan):
                for cc in range(colspan):
                    skip[r + rr][c + cc] = True

            attrs = ""
            if rowspan > 1: attrs += f" rowspan='{rowspan}'"
            if colspan > 1: attrs += f" colspan='{colspan}'"

            content = cell(table_data[r][c])
            cells_html.append(f"<td{attrs}>{content}</td>")

        rows_html.append(f"  <tr>{''.join(cells_html)}</tr>")

    return "<table class='pdf-table'>\n" + "\n".join(rows_html) + "\n</table>"

def extract_text_from_region(page, y_top, y_bottom):
    """Trích xuất chữ tuần tự trong một lát cắt vùng tọa độ Y nhất định."""
    if y_bottom <= y_top:
        return ""
    try:
        # Cắt trang theo dải ngang từ y_top tới y_bottom phủ toàn bộ chiều rộng trang
        cropped = page.crop((0, y_top, page.width, y_bottom))
        text = cropped.extract_text()
        return text if text else ""
    except Exception:
        return ""

def format_text_to_html(text: str) -> str:
    """Định dạng các khối text thô thành các khối <p> hoặc <h2> tương ứng."""
    if not text.strip():
        return ""
    
    # Chia nhỏ văn bản theo các dòng trống lớn để tách đoạn văn
    blocks = re.split(r'\n\s*\n', text)
    html_blocks = []
    
    for block in blocks:
        block_cleaned = block.strip()
        if not block_cleaned:
            continue
        
        # Nếu dòng quá ngắn và viết hoa, có khả năng cao là tiêu đề
        if len(block_cleaned) < 100 and (block_cleaned.isupper() or block_cleaned.istitle()):
            safe_title = block_cleaned.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            html_blocks.append(f"<h2>{safe_title}</h2>")
        else:
            # Escape HTML và giữ nguyên các ngắt dòng tự nhiên bằng thẻ <br>
            safe_text = block_cleaned.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            formatted_lines = safe_text.replace("\n", "<br>")
            html_blocks.append(f"<p>{formatted_lines}</p>")
            
    return "\n".join(html_blocks)

def convert_pdf_sequential_to_html(pdf_input) -> str:
    """
    Chuyển đổi tệp PDF (nhận đường dẫn hoặc bytes) thành HTML có cấu trúc.
    Xếp xen kẽ văn bản tuần tự và các bảng biểu chuẩn cấu trúc <table>.
    """
    # Hỗ trợ nhận trực tiếp bytes hoặc đường dẫn tệp
    if isinstance(pdf_input, bytes):
        pdf_file_obj = io.BytesIO(pdf_input)
    else:
        pdf_file_obj = pdf_input

    pages_html = []
    
    # Định cấu hình nhận dạng nét vẽ khung bảng biểu
    table_settings = {
        "vertical_strategy": "lines", 
        "horizontal_strategy": "lines",
        "intersection_tolerance": 15
    }

    with pdfplumber.open(pdf_file_obj) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            page_content = []
            
            # Tìm danh sách tất cả các bảng biểu trên trang hiện tại
            tables = page.find_tables(table_settings)
            # Sắp xếp thứ tự các bảng xuất hiện từ trên xuống dưới theo trục Y
            sorted_tables = sorted(tables, key=lambda t: t.bbox[1])
            
            current_y = 0  # Toạ độ quét bắt đầu từ đỉnh trang
            
            for table in sorted_tables:
                # Lấy toạ độ đỉnh (y_top) và đáy (y_bottom) của bảng
                y_top = table.bbox[1]
                y_bottom = table.bbox[3]
                
                # 1. Trích xuất chữ ở vùng trống từ đáy bảng trước (hoặc đỉnh trang) đến đỉnh bảng này
                text_above = extract_text_from_region(page, current_y, y_top)
                if text_above:
                    page_content.append(format_text_to_html(text_above))
                    
                # 2. Trích xuất dữ liệu và dựng thành bảng HTML chuẩn
                table_data = table.extract()
                if table_data:
                    page_content.append(table_to_html(table_data))
                    
                # Cập nhật vị trí quét hiện tại về đáy của bảng vừa xử lý
                current_y = y_bottom
                
            # 3. Trích xuất phần chữ còn lại từ đáy của bảng cuối cùng tới đáy trang giấy
            text_remaining = extract_text_from_region(page, current_y, page.height)
            if text_remaining:
                page_content.append(format_text_to_html(text_remaining))
                
            # Đóng gói trang vào container mô phỏng giao diện
            combined_page_content = "\n".join(page_content)
            wrapped_page = f"""
            <div class="pdf-page-container">
                <div class="page-number-header">Trang {page_num}</div>
                <div class="pdf-page-body">
                    {combined_page_content}
                </div>
            </div>
            """
            pages_html.append(wrapped_page)

    # Đã sửa: Thực hiện gộp danh sách các trang thành chuỗi bên ngoài f-string
    all_pages_combined = "\n".join(pages_html)

    # Khung sườn HTML tổng thể kèm CSS cho bảng biểu và đoạn văn
    full_html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Structured PDF Representation</title>
    <style>
        body {{
            background-color: #f5f7fa;
            margin: 0;
            padding: 40px 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        
        .pdf-page-container {{
            background-color: #ffffff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            margin-bottom: 40px;
            width: 850px;
            box-sizing: border-box;
            border-radius: 6px;
            border: 1px solid #e4e7ed;
        }}

        .page-number-header {{
            background-color: #fcfcfd;
            border-bottom: 1px solid #f2f6fc;
            padding: 12px 40px;
            font-size: 13px;
            color: #909399;
            font-weight: bold;
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
        }}

        .pdf-page-body {{
            padding: 40px;
        }}

        h2 {{
            color: #1a1a1a;
            font-size: 18px;
            margin-top: 25px;
            margin-bottom: 15px;
            border-bottom: 2px solid #333;
            padding-bottom: 4px;
            display: inline-block;
        }}

        p {{
            color: #2c3e50;
            font-size: 14px;
            line-height: 1.6;
            margin: 14px 0;
        }}

        /* Định dạng bảng biểu hiển thị sắc nét */
        .pdf-table {{
            border-collapse: collapse;
            width: 100%;
            margin: 24px 0;
            font-size: 13.5px;
        }}

        .pdf-table td {{
            border: 1px solid #2c3e50;
            padding: 8px 12px;
            vertical-align: top;
            line-height: 1.4;
            color: #2c3e50;
        }}

        /* Định dạng dòng đầu làm dòng tiêu đề màu nhạt */
        .pdf-table tr:first-child {{
            background-color: #f8fafc;
            font-weight: bold;
        }}
    </style>
</head>
<body>
    {all_pages_combined}
</body>
</html>"""

    return full_html

# ==========================================
# PHẦN 3: HÀM CHẠY CHÍNH (MAIN)
# ==========================================
def Qingdao_Everlasting_extract(file_bytes: bytes) -> dict:
    """
    Xử lý trực tiếp file PDF dạng bytes từ API và trích xuất dữ liệu của Qingdao Everlasting Co., Ltd.
    """
    pdf_file_obj = io.BytesIO(file_bytes)
    tables_html = []
    first_page_text = ""
    
    table_settings = {
        "vertical_strategy": "lines", 
        "horizontal_strategy": "lines",
        "intersection_tolerance": 15
    }

    with pdfplumber.open(pdf_file_obj) as pdf:
        if pdf.pages:
            first_page_text = pdf.pages[0].extract_text() or ""
            
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables(table_settings)
            for table_idx, table in enumerate(tables, start=1):
                html = table_to_html(table)
                tables_html.append(html)

        
    if tables_html:
        first_table_html = tables_html[0]
        result_json = extract_invoice_to_json(first_table_html, first_page_text)
        return result_json
    else:
        raise ValueError("Không tìm thấy bất kỳ bảng nào trong file PDF được tải lên.")