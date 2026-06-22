"""
main.py
-------
Điểm khởi động (entrypoint) ứng dụng FastAPI — SmartEntry OCR.

Vai trò: "Lễ tân / Cổng tổng"
    - Khởi tạo app và cấu hình CORS.
    - Tạo bảng SQLite tự động khi chạy lần đầu.
    - Gắn (mount) các APIRouter từ thư mục api/.
    - KHÔNG chứa logic nghiệp vụ — toàn bộ logic nằm trong api/*.py.

Chạy dev:
    uvicorn main:app --reload --port 8000
"""


from fastapi import FastAPI, Request, status
from fastapi.exceptions import ResponseValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware



from database import Base, engine
import models  # noqa: F401 — import để SQLAlchemy nhận diện các model trước khi create_all

# Import các router từ thư mục api/
from api import clients, invoices, suppliers, fileservice, contract

# ---------------------------------------------------------------------------
# Tự động tạo bảng trong SQLite nếu chưa tồn tại
# ---------------------------------------------------------------------------
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# Khởi tạo ứng dụng FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SmartEntry OCR API",
    description="Backend API cho ứng dụng đọc và bóc tách hóa đơn PDF.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# Cấu hình CORS
# allow_origins=["*"] cho phép Tauri WebView gọi API từ bất kỳ port / origin.
# Thu hẹp lại thành origin cụ thể khi deploy production.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Gắn các Router phụ vào app
# ---------------------------------------------------------------------------
app.include_router(suppliers.router)
app.include_router(invoices.router)
app.include_router(clients.router)
app.include_router(fileservice.router)
app.include_router(contract.router)

# ---------------------------------------------------------------------------
# Endpoint gốc — Health Check
# ---------------------------------------------------------------------------
@app.get("/", tags=["Health Check"])
def health_check() -> dict:
    """
    Tauri dùng endpoint này để kiểm tra backend đã khởi động chưa.
    Trả về ngay lập tức, không truy vấn DB.
    """
    return {"status": "ok", "message": "SmartEntry API is running"}

@app.exception_handler(ResponseValidationError)
async def response_validation_exception_handler(request: Request, exc: ResponseValidationError):
    # 1. Trích xuất toàn bộ lỗi chi tiết từ Pydantic
    errors = exc.errors()
    
    # 2. In toàn bộ vết lỗi chi tiết ra màn hình Terminal (Backend Console)
    print("\n" + "❌" * 30)
    print(" PHÁT HIỆN LỖI RESPONSE VALIDATION (DỮ LIỆU ĐẦU RA KHÔNG KHỚP SCHEMA) !!!")
    print(f"Đường dẫn bị lỗi: {request.method} {request.url.path}")
    print("Chi tiết các trường bị lệch pha giữa Database và Pydantic Schema:")
    
    for idx, error in enumerate(errors, 1):
        # Đường dẫn tới trường bị lỗi (Ví dụ: response -> 0 -> contract_code)
        loc = " -> ".join(str(l) for l in error.get("loc", []))
        print(f"  {idx}. Lỗi tại vị trí: {loc}")
        print(f"     Lý do: {error.get('msg')}")
        print(f"     Giá trị đầu vào gây lỗi: {error.get('input')}")
    print("❌" * 30 + "\n")
    
    # 3. Trả về Client (Frontend) chi tiết lỗi để bạn có thể xem trong F12 Network Tab
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Response Validation Error (Dữ liệu trả về từ DB lệch so với Schema)",
            "validation_errors": errors,
            "failed_url": str(request.url)
        }
    )