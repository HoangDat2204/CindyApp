"""
api/invoices.py
---------------
Router xử lý toàn bộ logic liên quan đến Hóa đơn (Invoices).
Prefix: /invoices

Endpoints:
    GET  /           → Danh sách hóa đơn (có phân trang, theo type)
    POST /           → Tạo mới hóa đơn + items cùng lúc (tự động chia nhánh theo type)
    GET  /search     → Tìm kiếm động theo nhiều tiêu chí (theo type)
"""

from datetime import date
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload



import models
import schemas
from database import get_db
import os
import shutil

router = APIRouter(prefix="/invoices", tags=["Invoices"])


# ---------------------------------------------------------------------------
# Helpers: base query với joinedload tương ứng cho từng loại hóa đơn
# ---------------------------------------------------------------------------
def _base_supplier_invoice_query(db: Session):
    """Query base cho Supplier Invoice, chống N+1 query."""
    return db.query(models.SupplierInvoice).options(
        joinedload(models.SupplierInvoice.supplier),
        joinedload(models.SupplierInvoice.items),
    )

def _base_client_invoice_query(db: Session):
    """Query base cho Client Invoice, chống N+1 query."""
    return db.query(models.ClientInvoice).options(
        joinedload(models.ClientInvoice.client),
        joinedload(models.ClientInvoice.items),
    )


# ---------------------------------------------------------------------------
# GET /invoices/products/search
# ---------------------------------------------------------------------------
@router.get("/products/search", status_code=status.HTTP_200_OK)
def search_products(
    q: str = Query("", description="Từ khóa tìm kiếm mã sản phẩm"),
    sources: str = Query("supplier,client,contract", description="Các nguồn tìm kiếm phân cách bằng dấu phẩy"),
    db: Session = Depends(get_db)
):
    sources_list = [s.strip().lower() for s in sources.split(",") if s.strip()]
    results = []

    # 1. Tìm kiếm trong Báo giá Nhà cung cấp (Supplier Invoice Items)
    if "supplier" in sources_list:
        sup_items = db.query(models.SupplierInvoiceItem).join(models.SupplierInvoice).filter(
            models.SupplierInvoiceItem.product_code.ilike(f"%{q}%")
        ).options(joinedload(models.SupplierInvoiceItem.invoice)).all()
        
        for item in sup_items:
            results.append({
                "source": "supplier",
                "date": item.invoice.date.isoformat() if (item.invoice and item.invoice.date) else None,
                "code": item.invoice.invoice_code if item.invoice else None,
                "partner_name": item.invoice.supplier_name if item.invoice else None,
                "product_code": item.product_code,
                "base_price": item.base_price,
                "quantity": item.quantity,
                "note": item.note,
                "extra_data": item.extra_data or {},
                "customFields": item.customFields or [],
                "currency": item.invoice.currency if item.invoice else "USD"
            })

    # 2. Tìm kiếm trong Báo giá cho Khách (Client Invoice Items)
    if "client" in sources_list:
        cli_items = db.query(models.ClientInvoiceItem).join(models.ClientInvoice).filter(
            models.ClientInvoiceItem.product_code.ilike(f"%{q}%")
        ).options(joinedload(models.ClientInvoiceItem.invoice)).all()
        
        for item in cli_items:
            results.append({
                "source": "client",
                "date": item.invoice.date.isoformat() if (item.invoice and item.invoice.date) else None,
                "code": item.invoice.invoice_code if item.invoice else None,
                "partner_name": item.invoice.client_name if item.invoice else None,
                "product_code": item.product_code,
                "base_price": item.base_price,
                "quantity": item.quantity,
                "note": item.note,
                "extra_data": item.extra_data or {},
                "customFields": item.customFields or [],
                "currency": item.invoice.currency if item.invoice else "USD"
            })

    # 3. Tìm kiếm trong Hợp đồng (Contracts)
    if "contract" in sources_list:
        contracts = db.query(models.Contract).options(
            joinedload(models.Contract.supplier_invoice).joinedload(models.SupplierInvoice.items),
            joinedload(models.Contract.client_invoice).joinedload(models.ClientInvoice.items)
        ).all()
        
        for contract in contracts:
            sup_matches = [it for it in (contract.supplier_invoice.items if contract.supplier_invoice else []) if q.lower() in (it.product_code or "").lower()]
            cli_matches = [it for it in (contract.client_invoice.items if contract.client_invoice else []) if q.lower() in (it.product_code or "").lower()]
            
            matched_codes = set(it.product_code for it in sup_matches) | set(it.product_code for it in cli_matches)
            for p_code in matched_codes:
                sup_it = next((it for it in (contract.supplier_invoice.items if contract.supplier_invoice else []) if it.product_code == p_code), None)
                cli_it = next((it for it in (contract.client_invoice.items if contract.client_invoice else []) if it.product_code == p_code), None)
                
                # Gom dữ liệu bổ sung từ cả hai phía
                extra_combined = {}
                if sup_it and sup_it.extra_data:
                    extra_combined.update(sup_it.extra_data)
                if cli_it and cli_it.extra_data:
                    extra_combined.update(cli_it.extra_data)
                    
                # Gom các trường tùy chỉnh
                cf_combined = []
                cf_seen = set()
                # Thêm customFields từ hợp đồng
                for cf in (contract.customFields or []):
                    if cf.get("key") and cf.get("key") not in cf_seen:
                        cf_combined.append(cf)
                        cf_seen.add(cf["key"])
                # Thêm customFields từ items
                for it in [sup_it, cli_it]:
                    if it and it.customFields:
                        for cf in it.customFields:
                            if cf.get("key") and cf.get("key") not in cf_seen:
                                cf_combined.append(cf)
                                cf_seen.add(cf["key"])

                results.append({
                    "source": "contract",
                    "date": contract.date.isoformat() if contract.date else None,
                    "code": contract.contract_code,
                    "invoice_code_sup": contract.supplier_invoice.invoice_code if contract.supplier_invoice else None,
                    "invoice_code_cli": contract.client_invoice.invoice_code if contract.client_invoice else None,
                    "partner_name_sup": contract.supplier_invoice.supplier_name if contract.supplier_invoice else None,
                    "partner_name_cli": contract.client_invoice.client_name if contract.client_invoice else None,
                    "product_code": p_code,
                    "price_sup": sup_it.base_price if sup_it else None,
                    "price_cli": cli_it.base_price if cli_it else None,
                    "qty_sup": sup_it.quantity if sup_it else None,
                    "qty_cli": cli_it.quantity if cli_it else None,
                    "commission": contract.commission,
                    "negotiation_margin": contract.negotiation_margin,
                    "profits": contract.profits,
                    "currency": contract.currency,
                    "discount": contract.discount,
                    "receiver": contract.receiver,
                    "status": contract.status,
                    "payment_status": contract.payment_status,
                    "sc": contract.sc,
                    "sc_no": contract.sc_no,
                    "note": contract.note,
                    "extra_data": extra_combined,
                    "customFields": cf_combined
                })

    return results


# ---------------------------------------------------------------------------
# GET /invoices/
# ---------------------------------------------------------------------------
@router.get("/")
def get_invoices(
    invoice_type: Literal["supplier", "client"] = Query(..., description="Loại hóa đơn: 'supplier' hoặc 'client'"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Trả về danh sách hóa đơn theo loại chỉ định, kèm liên kết và items.
    """
    if invoice_type == "supplier":
        return _base_supplier_invoice_query(db).offset(skip).limit(limit).all()
    else:
        return _base_client_invoice_query(db).offset(skip).limit(limit).all()


# ---------------------------------------------------------------------------
# GET /invoices/search
# ---------------------------------------------------------------------------
@router.get("/search")
def search_invoices(
    invoice_type: Literal["supplier", "client"] = Query(..., description="Bắt buộc chọn 'supplier' hoặc 'client'"),
    partner_id: Optional[int] = Query(None, description="Truyền supplier_id hoặc client_id tùy vào loại hóa đơn"),
    invoice_code: Optional[str] = None,  # Tham số này sẽ đóng vai trò là từ khóa tìm kiếm chung (keyword)
    status: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    exact_date: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Search Engine thông minh cho hóa đơn. Tự động tìm kiếm chéo trên nhiều trường liên quan.
    """
    if invoice_type == "supplier":
        query = _base_supplier_invoice_query(db)
        model = models.SupplierInvoice
    else:
        query = _base_client_invoice_query(db)
        model = models.ClientInvoice

    # --- Filter theo đối tác (giữ nguyên) ---
    if partner_id is not None:
        if invoice_type == "supplier":
            query = query.filter(model.supplier_id == partner_id)
        else:
            query = query.filter(model.client_id == partner_id)

    # ─── THAY THẾ KHỐI LỌC INVOICE_CODE CŨ BẰNG SEARCH ENGINE THÔNG MINH ───
    if invoice_code is not None and invoice_code.strip() != "":
        keyword = invoice_code.strip()
        if invoice_type == "supplier":
            # Search Engine cho Supplier Invoice: Tìm chéo Mã HĐ, Tên NCC, Mã SP bên trong items
            query = query.join(models.SupplierInvoice.items, isouter=True).filter(
                (models.SupplierInvoice.invoice_code.ilike(f"%{keyword}%")) |
                (models.SupplierInvoice.supplier_name.ilike(f"%{keyword}%")) |
                (models.SupplierInvoiceItem.product_code.ilike(f"%{keyword}%"))
            ).distinct()
        else:
            # Search Engine cho Client Invoice: Tìm chéo Mã HĐ, Tên Khách, Mã SP bên trong items
            query = query.join(models.ClientInvoice.items, isouter=True).filter(
                (models.ClientInvoice.invoice_code.ilike(f"%{keyword}%")) |
                (models.ClientInvoice.client_name.ilike(f"%{keyword}%")) |
                (models.ClientInvoiceItem.product_code.ilike(f"%{keyword}%"))
            ).distinct()

    # --- Filter các điều kiện khác (giữ nguyên) ---
    if status is not None:
        query = query.filter(model.status == status)

    if min_amount is not None:
        query = query.filter(model.total_amount_CIF >= min_amount)
    if max_amount is not None:
        query = query.filter(model.total_amount_CIF <= max_amount)

    if exact_date is not None:
        query = query.filter(model.date == exact_date)
    else:
        if start_date is not None:
            query = query.filter(model.date >= start_date)
        if end_date is not None:
            query = query.filter(model.date <= end_date)

    # ─── LOGIC GỢI Ý GẦN NHẤT KHI KHÔNG TÌM THẤY KẾT QUẢ ───
    results = query.offset(skip).limit(limit).all()
    
    if not results and invoice_code is not None and invoice_code.strip() != "":
        # Nếu không có kết quả khớp từ khóa, tự động trả về các hóa đơn mới nhất làm gợi ý gần nhất
        if invoice_type == "supplier":
            results = _base_supplier_invoice_query(db).order_by(models.SupplierInvoice.id.desc()).limit(limit).all()
        else:
            results = _base_client_invoice_query(db).order_by(models.ClientInvoice.id.desc()).limit(limit).all()

    return results


# ---------------------------------------------------------------------------
# POST /invoices/
# ---------------------------------------------------------------------------
def _persist_uploaded_file(temp_path: Optional[str]) -> Optional[str]:
    """
    Di chuyển tệp từ temp_uploads sang uploaded_files nếu có đường dẫn tạm.
    Trả về đường dẫn xem vĩnh viễn mới: /files/view/{filename}.
    """
    if not temp_path or not temp_path.startswith("/files/temp/"):
        return temp_path

    filename = temp_path.replace("/files/temp/", "")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    temp_file = os.path.join(base_dir, "temp_uploads", filename)
    dest_file = os.path.join(base_dir, "uploaded_files", filename)

    if os.path.exists(temp_file):
        try:
            os.makedirs(os.path.dirname(dest_file), exist_ok=True)
            shutil.move(temp_file, dest_file)
            return f"/files/view/{filename}"
        except Exception as e:
            print(f"Lỗi di chuyển file từ temp sang permanent: {e}")
            return temp_path
    elif os.path.exists(dest_file):
        return f"/files/view/{filename}"

    return temp_path


def _prepare_invoice_data(payload: schemas.InvoiceCreate):
    # Xác định loại hóa đơn dựa vào "invoice_type" hoặc sự xuất hiện của quotation_id/client_name
    inv_type = payload.invoice_type
    if not inv_type:
        if payload.quotation_id or payload.client_name:
            inv_type = "client"
        else:
            inv_type = "supplier"

    if inv_type == "client":
        # Ánh xạ từ các biến thể tên trường của phía client sang database
        invoice_code = payload.quotation_id or payload.invoice_code
        if not invoice_code:
            raise HTTPException(status_code=400, detail="Thiếu mã hóa đơn (quotation_id hoặc invoice_code).")
        
        invoice_date = payload.date_quotation or payload.date

        invoice_db_data = {
            "invoice_code": invoice_code,
            "client_id": payload.client_id,
            "client_name": payload.client_name,
            # "supplier_name": payload.supplier_name,
            "date": invoice_date,
            "total_amount_CIF": payload.total_amount_CIF,
            "clients_pdf_file_path": _persist_uploaded_file(payload.client_pdf_file_path),
            "status": payload.status,
            "payment_method": payload.payment_method,
            "currency": payload.currency,
            "customFields": payload.customFields or [],
        }
        return "client", invoice_db_data

    else:
        # Đối với Supplier
        invoice_code = payload.invoice_code or payload.quotation_id
        if not invoice_code:
            raise HTTPException(status_code=400, detail="Thiếu mã hóa đơn (invoice_code hoặc quotation_id).")
            
        invoice_date = payload.date or payload.date_quotation

        invoice_db_data = {
            "invoice_code": invoice_code,
            "supplier_id": payload.supplier_id,
            "supplier_name": payload.supplier_name,
            # "client": payload.client,
            "date": invoice_date,
            "total_amount_CIF": payload.total_amount_CIF,
            "suppliers_pdf_file_path": _persist_uploaded_file(payload.suppliers_pdf_file_path),
            "status": payload.status,
            "payment_method": payload.payment_method,
            "currency": payload.currency,
            "note": payload.note,
            "customFields": payload.customFields or [],
        }
        return "supplier", invoice_db_data


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
):
    """
    Tạo mới một hóa đơn đơn lẻ và tự động phân tách theo loại hóa đơn.
    """
    inv_type, invoice_data = _prepare_invoice_data(payload)

    if inv_type == "supplier":
        # Kiểm tra trùng lặp
        existing = db.query(models.SupplierInvoice).filter_by(invoice_code=invoice_data["invoice_code"]).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Mã hóa đơn {invoice_data['invoice_code']} đã tồn tại.")

        invoice = models.SupplierInvoice(**invoice_data)
        db.add(invoice)
        db.flush()

        for item_payload in payload.items:
            item = models.SupplierInvoiceItem(**item_payload.model_dump(), invoice_id=invoice.id)
            db.add(item)

    else: # client
        existing = db.query(models.ClientInvoice).filter_by(invoice_code=invoice_data["invoice_code"]).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Mã hóa đơn {invoice_data['invoice_code']} đã tồn tại.")

        invoice = models.ClientInvoice(**invoice_data)
        db.add(invoice)
        db.flush()

        for item_payload in payload.items:
            item = models.ClientInvoiceItem(**item_payload.model_dump(), invoice_id=invoice.id)
            db.add(item)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def create_multiple_invoices(
    payloads: List[schemas.InvoiceCreate],
    db: Session = Depends(get_db),
):
    """
    Lưu lô nhiều hóa đơn, phân biệt động loại hóa đơn và ghi xuống các bảng tương ứng.
    """
    if not payloads:
        raise HTTPException(status_code=400, detail="Danh sách hóa đơn trống.")

    created_count = 0
    try:
        for index, payload in enumerate(payloads):
            inv_type, invoice_data = _prepare_invoice_data(payload)

            if inv_type == "supplier":
                # Kiểm tra trùng lặp
                existing = db.query(models.SupplierInvoice).filter_by(invoice_code=invoice_data["invoice_code"]).first()
                if existing:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Hàng {index + 1}: Mã hóa đơn '{invoice_data['invoice_code']}' (Supplier) đã tồn tại."
                    )

                invoice = models.SupplierInvoice(**invoice_data)
                db.add(invoice)
                db.flush()

                for item_payload in payload.items:
                    item = models.SupplierInvoiceItem(**item_payload.model_dump(), invoice_id=invoice.id)
                    db.add(item)

            elif inv_type == "client":

                # Kiểm tra trùng lặp
                existing = db.query(models.ClientInvoice).filter_by(invoice_code=invoice_data["invoice_code"]).first()
                if existing:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Hàng {index + 1}: Mã hóa đơn '{invoice_data['invoice_code']}' (Client) đã tồn tại."
                    )

                invoice = models.ClientInvoice(**invoice_data)
                db.add(invoice)
                db.flush()

                for item_payload in payload.items:
                    item = models.ClientInvoiceItem(**item_payload.model_dump(), invoice_id=invoice.id)
                    db.add(item)

            created_count += 1

        db.commit()
        return {"status": "success", "message": f"Đã lưu thành công {created_count} hóa đơn."}

    except HTTPException as http_exc:
        db.rollback() 
        raise http_exc
    except Exception as e:
        db.rollback() 
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi lưu bulk: {str(e)}")

@router.put("/{id}", status_code=status.HTTP_200_OK)
def update_invoice(
    id: int,
    invoice_type: Literal["supplier", "client"] = Query(..., description="Loại hóa đơn: 'supplier' hoặc 'client'"),
    payload: schemas.InvoiceCreate = None,
    db: Session = Depends(get_db),
):
    """
    Cập nhật một hóa đơn (Supplier / Client) và các items liên kết của nó.
    """
    if invoice_type not in ["supplier", "client"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loại hóa đơn không hợp lệ. Chỉ chấp nhận 'supplier' hoặc 'client'."
        )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thiếu dữ liệu cập nhật."
        )

    if invoice_type == "supplier":
        invoice = db.query(models.SupplierInvoice).filter(models.SupplierInvoice.id == id).first()
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hóa đơn nhà cung cấp với ID {id}."
            )
        
        # Kiểm tra trùng lặp mã hóa đơn mới (nếu thay đổi code)
        new_code = payload.invoice_code or payload.quotation_id
        if new_code and new_code != invoice.invoice_code:
            existing = db.query(models.SupplierInvoice).filter(
                models.SupplierInvoice.invoice_code == new_code,
                models.SupplierInvoice.id != id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mã hóa đơn {new_code} đã tồn tại."
                )

        # Cập nhật thông tin header
        invoice.invoice_code = new_code
        invoice.supplier_id = payload.supplier_id
        invoice.supplier_name = payload.supplier_name
        invoice.date = payload.date or payload.date_quotation
        invoice.total_amount_CIF = payload.total_amount_CIF
        invoice.status = payload.status
        invoice.payment_method = payload.payment_method
        invoice.currency = payload.currency
        invoice.note = payload.note
        invoice.customFields = payload.customFields or []
        
        if payload.suppliers_pdf_file_path:
            invoice.suppliers_pdf_file_path = _persist_uploaded_file(payload.suppliers_pdf_file_path)

        # Xóa các dòng sản phẩm cũ
        db.query(models.SupplierInvoiceItem).filter(models.SupplierInvoiceItem.invoice_id == id).delete()

        # Thêm các dòng sản phẩm mới
        for item_payload in payload.items:
            item = models.SupplierInvoiceItem(**item_payload.model_dump(), invoice_id=id)
            db.add(item)

    else:  # client
        invoice = db.query(models.ClientInvoice).filter(models.ClientInvoice.id == id).first()
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hóa đơn khách hàng với ID {id}."
            )

        # Kiểm tra trùng lặp mã hóa đơn mới (nếu thay đổi code)
        new_code = payload.quotation_id or payload.invoice_code
        if new_code and new_code != invoice.invoice_code:
            existing = db.query(models.ClientInvoice).filter(
                models.ClientInvoice.invoice_code == new_code,
                models.ClientInvoice.id != id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mã hóa đơn {new_code} đã tồn tại."
                )

        # Cập nhật thông tin header
        invoice.invoice_code = new_code
        invoice.client_id = payload.client_id
        invoice.client_name = payload.client_name
        invoice.date = payload.date_quotation or payload.date
        invoice.total_amount_CIF = payload.total_amount_CIF
        invoice.status = payload.status
        invoice.payment_method = payload.payment_method
        invoice.currency = payload.currency
        invoice.customFields = payload.customFields or []

        if payload.client_pdf_file_path:
            invoice.clients_pdf_file_path = _persist_uploaded_file(payload.client_pdf_file_path)

        # Xóa các dòng sản phẩm cũ
        db.query(models.ClientInvoiceItem).filter(models.ClientInvoiceItem.invoice_id == id).delete()

        # Thêm các dòng sản phẩm mới
        for item_payload in payload.items:
            item = models.ClientInvoiceItem(**item_payload.model_dump(), invoice_id=id)
            db.add(item)

    db.commit()
    
    # Trả về kết quả sau khi tải lại thông tin đã join
    if invoice_type == "supplier":
        return _base_supplier_invoice_query(db).filter(models.SupplierInvoice.id == id).first()
    else:
        return _base_client_invoice_query(db).filter(models.ClientInvoice.id == id).first()


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def delete_invoice(
    id: int,
    invoice_type: str,  # Nhận 'supplier' hoặc 'client' từ query parameter
    db: Session = Depends(get_db),
):
    """
    Xóa hóa đơn dựa trên ID và phân loại hóa đơn (Supplier / Client).
    """
    # 1. Kiểm tra tính hợp lệ của loại hóa đơn
    if invoice_type not in ["supplier", "client"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loại hóa đơn không hợp lệ. Chỉ chấp nhận 'supplier' hoặc 'client'."
        )

    # 2. Xử lý xóa theo loại hóa đơn
    if invoice_type == "supplier":
        # Truy vấn tìm hóa đơn nhà cung cấp
        invoice = db.query(models.SupplierInvoice).filter(models.SupplierInvoice.id == id).first()
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hóa đơn nhà cung cấp với ID {id}."
            )
        
        # Nếu mô hình SQLAlchemy của bạn chưa cấu hình Cascade Delete (ondelete="CASCADE") ở mức quan hệ,
        # bạn có thể cần xóa thủ công các Items liên quan trước để tránh lỗi ràng buộc khóa ngoại (Foreign Key):
        # db.query(models.SupplierInvoiceItem).filter_by(invoice_id=id).delete()
        
        db.delete(invoice)

    else:  # client
        # Truy vấn tìm hóa đơn khách hàng
        invoice = db.query(models.ClientInvoice).filter(models.ClientInvoice.id == id).first()
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hóa đơn khách hàng với ID {id}."
            )
        
        # Xóa các Items liên quan nếu chưa có Cascade Delete cấu hình sẵn:
        # db.query(models.ClientInvoiceItem).filter_by(invoice_id=id).delete()
        
        db.delete(invoice)

    # 3. Lưu thay đổi vào Database
    db.commit()

    return {"message": f"Đã xóa thành công hóa đơn với ID {id}."}