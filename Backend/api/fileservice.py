"""
api/fileservice.py
------------------
Router xử lý nghiệp vụ upload và trích xuất dữ liệu từ file PDF/Image.
Prefix: /files

Pipeline tổng quát:
    Upload file → identify_file_owner() → process_supplier/client_file() → JSON result

Nhớ đăng ký router này vào main.py:
    from api import fileservice
    app.include_router(fileservice.router)
"""

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from services.suppliers import Inarco_ocr, Qingdao_everlasting_ocr, Ideal_ocr, Chenyu_ocr, KaiGong_ocr, Mesdan_ocr, Pinter_ocr, Rongda_ocr, Sabar_ocr, Toyotsu_ocr, Guangxinhui_ocr, Hicorp_ocr, Uster_ocr, HOLZ_ocr, MURATA_ocr, BEST_ocr
from services import client_invoice_ocr
from services import llm_parser
import json
import os
import time

router = APIRouter(prefix="/files", tags=["File Service"])

# Đảm bảo các thư mục lưu trữ tồn tại
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMP_DIR = os.path.join(BASE_DIR, "temp_uploads")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploaded_files")
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Hàm xử lý logic — Placeholder (tự điền implementation vào đây)
# ---------------------------------------------------------------------------
import io
import pdfplumber
import re


def extract_text_with_pdfplumber(file_bytes: bytes) -> str:
    """
    Sử dụng pdfplumber để trích xuất text từ file PDF.
    """
    full_text = ""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    full_text += extracted + "\n"
    except Exception as e:
        print(f"Lỗi đọc PDF bằng pdfplumber: {e}")
        
    return full_text





def supplier_identify(extracted_text:str) -> str:
    if ("INARCO" in extracted_text):
        return "INARCO"
    elif "KAIGONG" in extracted_text:
        return "KAIGONG"
    elif "IDEAL" in extracted_text:
        return "IDEAL"
    elif "SABAR" in extracted_text:
        return "SABAR"
    elif "GUANGXINHUI" in extracted_text:
        return "GUANGXINHUI"
    elif "HICORP" in extracted_text:
        return "HICORP"
    elif "USTER" in extracted_text:
        return "USTER"
    elif "HOLZ" in extracted_text:
        return "HOLZ"
    elif "MURATA" in extracted_text:
        return "MURATA"
    elif "BEST" in extracted_text:
        return "BEST"

def identify_file_owner(file_bytes: bytes) -> dict:
    """
    Nhận diện file PDF thuộc về Nhà cung cấp hay Khách hàng.
    """
    extracted_text = extract_text_with_pdfplumber(file_bytes).upper()
    
    try:
        print(extracted_text.encode('ascii', errors='replace').decode('ascii'))
    except Exception:
        pass
    if not extracted_text:
        return {"owner_type": "unknown", "owner_id": None}

    # --- Uu tien 1: Phat hien Nha cung cap bằng chu ký dac trung khoang cach lon ---
    if "INARCO PRIVATE LTD" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 1
        }

    if "QINGDAO EVERLASTING CO., LTD." in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 2
        }

    if "IDEAL SHEET METAL STAMPINGS & PRESSINGS" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 3
        }

    if "山西辰宇" in extracted_text or "SHANXI CHENYU" in extracted_text or "CHENYU" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 4
        }

    if "JIANGSU KAIGONG" in extracted_text or "KAIGONG" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 5
        }

    if "MESDAN" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 6
        }

    if "PINTER" in extracted_text or "OPTIFIL" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 7
        }

    if "RONGDA" in extracted_text or "HAINA" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 8
        }

    if "SABAR SPINMATIC" in extracted_text or "SABAR SPINMATIC EQUIPMENTS LLP" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 9
        }

    if "TOYOTSU MACHINERY" in extracted_text or "TOYOTSU MACHINERY CORPORATION" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 10
        }

    if "GUANGXINHUI" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 11
        }

    if "HICORP MACHINERY" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 12
        }

    if "USTER TECHNOLOGIES" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 13
        }

    if "FABRIK FÜR TEXTILMASCHINEN-ZUBEHÖR" in extracted_text or "HERMANN HOLZ" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 13
        }

    if "TEXTILE MACHINERY DIVISION" in extracted_text and "TAKEDA-MUKAISHIRO-CHO" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 14
        }

    if "BEST MACHINERY" in extracted_text:
        return {
            "owner_type": "supplier",
            "owner_id": 15
        }

    # --- Uu tien 2: Phat hien bao gia Timtex gui cho khach hang (Client Invoice) ---
    if "TIMTEX TRADING CO" in extracted_text or "BẢN CHÀO GIÁ" in extracted_text:
        return {
            "owner_type": "client",
            "owner_id": None  # client_id duoc xac dinh trong client_extract()
        }

    return {
        "owner_type": "unknown",
        "owner_id": None
    }



def identify_file_client_id(client_name: str) -> int:
    """
    Nhận diện file PDF thuộc về Nhà cung cấp hay Khách hàng.
    """
    


    if "PHONG PHU" in client_name.upper() or "PHONG PHÚ" in client_name.upper():
        return 1
        
    
    if "TAHTONG" in client_name.upper():
        return 2
        



def process_supplier_file(file_bytes: bytes, supplier_id: int) -> dict:
    """
    Bóc tách dữ liệu hóa đơn từ file PDF/Image của Nhà cung cấp.

    TODO: Điền implementation vào đây.
          Gợi ý: Lấy default_template_config của supplier từ DB,
                 chạy OCR + LLM để trích xuất invoice_code, date,
                 total_amount, danh sách items theo template config.

    Args:
        file_bytes  : Nội dung raw của file upload.
        supplier_id : ID của nhà cung cấp đã được nhận diện.

    Returns:
        dict chứa dữ liệu hóa đơn đã bóc tách, tương thích với
        schema InvoiceCreate để lưu vào database.
    """
    if (supplier_id == 1):
        result = Inarco_ocr.Inarco_extract(file_bytes)
    elif (supplier_id == 2):
        result = Qingdao_everlasting_ocr.Qingdao_Everlasting_extract(file_bytes)
    elif (supplier_id == 3):
        result = Ideal_ocr.Ideal_extract(file_bytes)
    elif (supplier_id == 4):
        result = Chenyu_ocr.Chenyu_extract(file_bytes)
    elif (supplier_id == 5):
        result = KaiGong_ocr.KaiGong_extract(file_bytes)
    elif (supplier_id == 6):
        result = Mesdan_ocr.Mesdan_extract(file_bytes)
    elif (supplier_id == 7):
        result = Pinter_ocr.Pinter_extract(file_bytes)
    elif (supplier_id == 8):
        result = Rongda_ocr.Rongda_extract(file_bytes)
    elif (supplier_id == 9):
        result = Sabar_ocr.Sabar_extract(file_bytes)
    elif (supplier_id == 10):
        result = Toyotsu_ocr.Toyotsu_extract(file_bytes)
    elif (supplier_id == 11):
        result = Guangxinhui_ocr.Guangxinhui_extract(file_bytes)
    elif (supplier_id == 12):
        result = Hicorp_ocr.Hicorp_extract(file_bytes)
    elif (supplier_id == 13):
        text_upper = extract_text_with_pdfplumber(file_bytes).upper()
        if "HOLZ" in text_upper or "FABRIK FÜR TEXTILMASCHINEN-ZUBEHÖR" in text_upper:
            result = HOLZ_ocr.HOLZ_extract(file_bytes)
        else:
            result = Uster_ocr.Uster_extract(file_bytes)
    elif (supplier_id == 14):
        result = MURATA_ocr.MURATA_extract(file_bytes)
    elif (supplier_id == 15):
        result = BEST_ocr.BEST_extract(file_bytes)

    return result


def process_client_file(file_bytes: bytes, client_id, supplier_name: str = None) -> dict:
    """
    Boc tach du lieu hoa don tu file PDF cua Timtex gui cho khach hang.
    Su dung client_invoice_ocr.client_extract() xu ly tat ca loai bao gia client.
    """
    result = client_invoice_ocr.client_extract(file_bytes)
    return result

# ---------------------------------------------------------------------------
# Endpoint chính
# ---------------------------------------------------------------------------

@router.post("/extract", status_code=status.HTTP_200_OK)
async def extract_invoice_from_file(
    file: UploadFile = File(..., description="File PDF hoặc Image của hóa đơn cần bóc tách."),
) -> dict:
    """
    Pipeline OCR Extraction:

        1. Nhận file upload từ Frontend.
        2. Đọc nội dung file (bytes).
        3. Gọi identify_file_owner() để xác định loại file (supplier/client).
        4. Điều hướng sang process_supplier_file() hoặc process_client_file().
        5. Trả về JSON dữ liệu đã bóc tách cho Frontend.

    Raises:
        HTTP 400: Không thể nhận diện loại file, hoặc file không hợp lệ.
        HTTP 422: File rỗng hoặc không đọc được.
        HTTP 500: Lỗi nội bộ trong quá trình xử lý OCR / LLM.
    """
    # --- Bước 1: Đọc nội dung file ---
    try:
        file_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Không thể đọc file '{file.filename}': {exc}",
        ) from exc

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File upload rỗng. Vui lòng kiểm tra lại file.",
        )
    
    # --- Lưu tệp tạm thời ---
    timestamp = int(time.time() * 1000)
    safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._-")
    unique_filename = f"temp_{timestamp}_{safe_filename}"
    temp_file_path = os.path.join(TEMP_DIR, unique_filename)
    try:
        with open(temp_file_path, "wb") as buffer:
            buffer.write(file_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lưu file tạm thời: {exc}",
        )

    # --- Bước 2: Nhận diện chủ sở hữu file ---
    try:
        owner_info = identify_file_owner(file_bytes)
        print(owner_info)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Chức năng nhận diện file chưa được implement.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi nhận diện file: {exc}",
        ) from exc

    owner_type = owner_info.get("owner_type", "unknown")
    owner_id = owner_info.get("owner_id")

    # --- Bước 3: Điều hướng xử lý theo loại file ---
    if owner_type == "supplier":
        result = process_supplier_file(file_bytes, supplier_id=owner_id)
        if isinstance(result, dict):
            result["suppliers_pdf_file_path"] = f"/files/temp/{unique_filename}"

    elif owner_type == "client":
        result = process_client_file(file_bytes, client_id=owner_id, supplier_name = owner_info.get("supplier_name"))
        if isinstance(result, dict):
            result["client_pdf_file_path"] = f"/files/temp/{unique_filename}"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Không thể nhận diện loại file. "
                "Hệ thống không xác định được đây là hóa đơn của "
                "Nhà cung cấp hay Khách hàng."
            ),
        )

    # --- Bước 4: Trả về kết quả ---
    return {
        "status": "success",
        "filename": file.filename,
        "extracted_data": result,
    }


@router.get("/temp/{filename}", tags=["File Service"])
def get_temp_file(filename: str):
    """
    Phục vụ tệp xem tạm thời từ thư mục temp_uploads.
    """
    file_path = os.path.join(TEMP_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy file tạm '{filename}' trên server.",
        )
    return FileResponse(file_path)


@router.get("/view/{filename}", tags=["File Service"])
def get_view_file(filename: str):
    """
    Phục vụ tệp xem vĩnh viễn từ thư mục uploaded_files.
    """
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy file '{filename}' trên server.",
        )
    return FileResponse(file_path)