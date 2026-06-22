from bs4 import BeautifulSoup

def _get_td_text(td_list, idx, default=""):
    """Hàm helper hỗ trợ lấy text từ danh sách thẻ td an toàn."""
    if idx < len(td_list):
        return td_list[idx].get_text(" ", strip=True)
    return default

def _to_float(s):
    """Hàm helper chuyển đổi string sang float an toàn."""
    try:
        return float(s.strip())
    except (ValueError, TypeError, AttributeError):
        return None

def extract_products(html_content):
    """
    Hàm xử lý Backend: 
    Nhận nội dung file HTML (string hoặc bytes) và trả về JSON (Dictionary) dữ liệu sản phẩm.
    """
    soup = BeautifulSoup(html_content, "html.parser")
    
    table = soup.find("table")
    if not table:
        return {"products": []} # Trả về rỗng nếu không tìm thấy bảng

    all_rows = table.find_all("tr")
    products = []

    for tr in all_rows:
        tds = tr.find_all("td")

        # Điều kiện nhận diện hàng sản phẩm
        if len(tds) < 10:
            continue

        sr_text = _get_td_text(tds, 0)
        code_text = _get_td_text(tds, 1)

        # Kiểm tra SR NO
        if not sr_text.isdigit():
            continue
            
        sr_no = int(sr_text)
        if sr_no < 1 or sr_no > 14:
            continue
            
        # Kiểm tra Format mã sản phẩm
        if not (("-" in code_text or "/" in code_text) and any(c.isalpha() for c in code_text)):
            continue

        hardness_raw = _get_td_text(tds, 6)
        qty_raw = _to_float(_get_td_text(tds, 8))
        
        product = {
            "Product Code": code_text,
            "Size": {
                "BRD": _to_float(_get_td_text(tds, 2)),
                "FOD": _to_float(_get_td_text(tds, 3)),
                "Width": _to_float(_get_td_text(tds, 4)),
            },
            "Special Process": _get_td_text(tds, 5),
            "Hardness": _to_float(hardness_raw) if hardness_raw else None,
            "Unit Price": _to_float(_get_td_text(tds, 7)),
            "Quantity Piece": int(qty_raw) if qty_raw is not None else None,
            "Total USD": _to_float(_get_td_text(tds, 9)),
            "Net Weight": _to_float(_get_td_text(tds, 10)),
            "Gross Weight": _to_float(_get_td_text(tds, 11)),
        }
        products.append(product)

    return {"products": products}