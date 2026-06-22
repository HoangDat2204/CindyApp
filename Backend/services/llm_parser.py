import requests
import json
import os





def extract_invoice_with_qwen(html_content: str):
    import requests
    import json
    
    url = "http://localhost:11434/api/generate"
    
    prompt = """Tôi là một nhà phân phối trung gian giữa bên nhà cung cấp và supplier, đoạn HTML bên dưới là hóa đơn tôi báo giá cho phía khách hàng về các sản phẩm. Tôi muốn bạn dựa vào ngữ nghĩa hóa đơn trong đoạn HTML bên dưới trích xuất ra các thông tin cần thiết và chuyển thành dạng Json với định dạng như sau (lưu ý là chỉ trả về Json không giải thích gì thêm): 

{
    "date_quotation": "{ngày tạo hóa đơn, ngày báo giá trường này luôn tồn tại}",
    "quotation_id": "{ID, số của hóa đơn trường này luôn tồn  tại}",
    "invoice_type": "{luôn gán giá trị là 'client'}",
    "client_name": "{tên của khách hàng nhận được hóa đơn, người nhận trường này luôn tồn tại}",
    "supplier_name": "{tên của nhà cung cấp sản phẩm, sản phẩm tới từ nhà cung cấp nào nhớ rằng TIMTEX TRADING CO., LTD là công ty của tôi là trung gian không là nhà cung cấp}",
    "client_id": "{luôn gán giá trị là 1}",
    "client_pdf_file_path": null,
    "status": "pending",
    "payment_method": "{phương thức thanh toán đề cập trong hóa đơn}",
    "total_amount_CIF": "{tổng tiền CIF của các sản phẩm}",
    "items": [ là một danh sách các sản phẩm được báo giá trong hóa đơn trong đó mỗi sản phẩm bao gồm các trường  
        {
            "product_code": "{Mã sản phẩm hoặc tên của sản phẩm ( ưu tiên mã sản phẩm )}", 
            "quantity": "{Số lượng sản phẩm nếu không tìm thấy có thể để null}", 
            "base_price": "{Giá tiền mỗi sản phẩm đó}", 
            "extra_column": "{Là một json trong đó gồm các key là cột còn lại (ngoài cột mã sản phẩm, số lượng, giá tiền mỗi sản phẩm) và value là giá trị của cột đó của sản phẩm đó}"
        }
    ]
}

Nội dung HTML:
""" + html_content

    # Đoạn cấu hình payload gửi đi giữ nguyên như cũ của bạn
    payload = {
        "model": "qwen2.5:3b", 
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.5
        }
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        raw_response_text = result.get('response', '')
        
        extracted_data = json.loads(raw_response_text)
        return extracted_data

    except json.JSONDecodeError:
        print("Lỗi: Qwen trả về kết quả không phải là JSON hợp lệ.")
        print("Kết quả thô:", raw_response_text)
        return None
    except Exception as e:
        print(f"Lỗi khi kết nối với Ollama: {e}")
        return None


# --- PHẦN TEST ĐỌC TỪ FILE THỰC TẾ ---
if __name__ == "__main__":
    # Tên file HTML bạn muốn đọc (đảm bảo file này nằm cùng thư mục với script Python)
    html_file_path = "extracted_tables.html"
    
    # Kiểm tra xem file có tồn tại không trước khi đọc
    if not os.path.exists(html_file_path):
        print(f"Không tìm thấy file: {html_file_path}")
        print("Vui lòng tạo file này và dán nội dung HTML vào để test.")
    else:
        # Đọc nội dung file HTML
        # BẮT BUỘC dùng encoding="utf-8" để Python không bị lỗi font khi đọc tiếng Việt
        with open(html_file_path, "r", encoding="utf-8") as file:
            html_content = file.read()
            
        print("Đã đọc xong file HTML. Đang gửi yêu cầu tới Qwen...")
        
        # Truyền nội dung HTML vừa đọc vào AI Engine
        json_result = extract_invoice_with_qwen(html_content)
        
        if json_result:
            print("\nKết quả JSON chuẩn hóa:")
            print(json.dumps(json_result, indent=4, ensure_ascii=False))