# contract.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from database import get_db

router = APIRouter(prefix="/contracts", tags=["Contracts"])


def _base_contract_query(db: Session):
    """
    Helper function: Query base cho Contract, join sẵn với 2 bảng hóa đơn
    để tiện trích xuất thông tin mà không bị lỗi N+1 Query.
    """
    return db.query(models.Contract).options(
        joinedload(models.Contract.supplier_invoice).joinedload(models.SupplierInvoice.items),
        joinedload(models.Contract.client_invoice).joinedload(models.ClientInvoice.items)
    )


# ---------------------------------------------------------------------------
# GET /contracts/suggest/supplier (Gợi ý hóa đơn Supplier)
# ---------------------------------------------------------------------------
@router.get("/suggest/supplier", status_code=status.HTTP_200_OK)
def suggest_supplier_invoices(
    q: str = Query("", description="Tiền tố hoặc từ khóa tìm kiếm mã hóa đơn Nhà cung cấp"),
    db: Session = Depends(get_db)
):
    """
    Gợi ý danh sách hóa đơn từ Nhà cung cấp dựa trên mã hóa đơn.
    Để tối ưu, loại trừ các hóa đơn đã được liên kết với một hợp đồng nào đó.
    """
    # Lấy danh sách ID hóa đơn Supplier đã nằm trong bảng Contracts
    used_ids_query = db.query(models.Contract.supplier_invoice_id).filter(
        models.Contract.supplier_invoice_id.isnot(None)
    )
    
    # Query hóa đơn chưa liên kết
    query = db.query(models.SupplierInvoice).filter(
        ~models.SupplierInvoice.id.in_(used_ids_query)
    )
    
    if q:
        # Tìm kiếm bằng LIKE (Tận dụng Index của cơ sở dữ liệu nếu có)
        query = query.filter(models.SupplierInvoice.invoice_code.ilike(f"{q}%"))
        
    results = query.limit(10).all()
    
    return [
        {
            "id": invoice.id,
            "invoice_code": invoice.invoice_code,
            "supplier_name": invoice.supplier_name or (invoice.supplier.name if invoice.supplier else "N/A"),
            "total_amount_CIF": invoice.total_amount_CIF or 0.0,
            "currency": invoice.currency or "USD"
        }
        for invoice in results
    ]


# ---------------------------------------------------------------------------
# GET /contracts/suggest/client (Gợi ý hóa đơn Client)
# ---------------------------------------------------------------------------
@router.get("/suggest/client", status_code=status.HTTP_200_OK)
def suggest_client_invoices(
    q: str = Query("", description="Tiền tố hoặc từ khóa tìm kiếm mã hóa đơn Khách hàng"),
    db: Session = Depends(get_db)
):
    """
    Gợi ý danh sách hóa đơn gửi cho Khách hàng dựa trên mã hóa đơn.
    Loại trừ các hóa đơn đã được liên kết với một hợp đồng khác.
    """
    # Lấy danh sách ID hóa đơn Client đã nằm trong bảng Contracts
    used_ids_query = db.query(models.Contract.client_invoice_id).filter(
        models.Contract.client_invoice_id.isnot(None)
    )
    
    # Query hóa đơn chưa liên kết
    query = db.query(models.ClientInvoice).filter(
        ~models.ClientInvoice.id.in_(used_ids_query)
    )
    
    if q:
        query = query.filter(models.ClientInvoice.invoice_code.ilike(f"{q}%"))
        
    results = query.limit(10).all()
    
    return [
        {
            "id": invoice.id,
            "invoice_code": invoice.invoice_code,
            "client_name": invoice.client_name or (invoice.client.name if invoice.client else "N/A"),
            "total_amount_CIF": invoice.total_amount_CIF or 0.0,
            "currency": invoice.currency or "USD"
        }
        for invoice in results
    ]


# ---------------------------------------------------------------------------
# POST /contracts/ (Tạo hợp đồng & Tự động tính toán Profit)
# ---------------------------------------------------------------------------
@router.post("/", response_model=schemas.ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(
    payload: schemas.ContractCreate,
    db: Session = Depends(get_db)
):
    # 1. KIỂM TRA MÃ HỢP ĐỒNG ĐÃ TỒN TẠI CHƯA
    existing_code = db.query(models.Contract).filter(
        models.Contract.contract_code == payload.contract_code
    ).first()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mã hợp đồng '{payload.contract_code}' đã tồn tại trong hệ thống!"
        )

    # 2. Kiểm tra Supplier Invoice và Client Invoice có tồn tại hay không
    supplier_inv = db.query(models.SupplierInvoice).filter(models.SupplierInvoice.id == payload.supplier_invoice_id).first()
    client_inv = db.query(models.ClientInvoice).filter(models.ClientInvoice.id == payload.client_invoice_id).first()
    
    # ... (giữ nguyên logic kiểm tra invoice tồn tại & trùng lặp map 1-1) ...

    # 3. LOGIC SO SÁNH TIỀN TỆ (CURRENCY)
    supplier_curr = (supplier_inv.currency or "USD").strip().upper()
    client_curr = (client_inv.currency or "USD").strip().upper()
    
    if supplier_curr == client_curr:
        contract_currency = supplier_curr
    else:
        contract_currency = "Không thống nhất" # Hoặc gán chuỗi thông báo tùy chọn

    # 5. Khởi tạo dữ liệu và đè biến currency bằng contract_currency vừa tính
    contract_data = payload.model_dump()
    # profits đã được lấy trực tiếp từ payload người dùng nhập
    contract_data["currency"] = contract_currency # Lưu kết quả thống nhất tiền tệ

    new_contract = models.Contract(**contract_data)
    db.add(new_contract)
    db.commit()
    db.refresh(new_contract)

    return _base_contract_query(db).filter(models.Contract.id == new_contract.id).first()


# ---------------------------------------------------------------------------
# PUT /contracts/{id} (Cập nhật hợp đồng)
# ---------------------------------------------------------------------------
@router.put("/{contract_id}", response_model=schemas.ContractResponse)
def update_contract(
    contract_id: int,
    payload: schemas.ContractUpdate,
    db: Session = Depends(get_db)
):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Không tìm thấy hợp đồng")
        
    update_data = payload.model_dump(exclude_unset=True)

    # Nếu cập nhật mã hợp đồng mới, kiểm tra trùng lặp (ngoại trừ chính nó)
    if "contract_code" in update_data and update_data["contract_code"] != contract.contract_code:
        duplicate = db.query(models.Contract).filter(
            models.Contract.contract_code == update_data["contract_code"]
        ).first()
        if duplicate:
            raise HTTPException(status_code=400, detail=f"Mã hợp đồng '{update_data['contract_code']}' đã tồn tại!")

    for key, val in update_data.items():
        setattr(contract, key, val)
        
    # Tính toán lại lợi nhuận và tiền tệ thống nhất
    supplier_inv = db.query(models.SupplierInvoice).filter(models.SupplierInvoice.id == contract.supplier_invoice_id).first()
    client_inv = db.query(models.ClientInvoice).filter(models.ClientInvoice.id == contract.client_invoice_id).first()
    
    if supplier_inv and client_inv:
        # ─── THỐNG NHẤT TIỀN TỆ TRONG PUT ───
        s_curr = (supplier_inv.currency or "USD").strip().upper()
        c_curr = (client_inv.currency or "USD").strip().upper()
        contract.currency = s_curr if s_curr == c_curr else "Không thống nhất"
        
    db.commit()
    db.refresh(contract)
    return _base_contract_query(db).filter(models.Contract.id == contract.id).first()


# ---------------------------------------------------------------------------
# DELETE /contracts/{id} (Xóa hợp đồng)
# ---------------------------------------------------------------------------
@router.delete("/{contract_id}", status_code=status.HTTP_200_OK)
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    Xóa một hợp đồng dựa trên ID.
    """
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hợp đồng id={contract_id}"
        )
    db.delete(contract)
    db.commit()
    return {"detail": f"Đã xóa thành công hợp đồng id={contract_id}"}



@router.get("/search", response_model=List[schemas.ContractResponse])
def search_contracts(
    q: str = Query("", description="Từ khóa tìm kiếm hợp đồng"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Search Engine thông minh cho Hợp đồng. 
    Tìm chéo theo Mã hợp đồng, Mã hóa đơn NCC, Mã hóa đơn khách hàng, 
    Tên NCC, Tên Khách hàng và Mã sản phẩm thuộc cả 2 loại hóa đơn chốt.
    """
    print("Hello")
    query = _base_contract_query(db)
    
    if q and q.strip() != "":
        keyword = q.strip()
        # Thực hiện Join sâu để tìm kiếm trên toàn bộ dữ liệu liên đới
        query = query.join(models.Contract.supplier_invoice, isouter=True) \
                     .join(models.Contract.client_invoice, isouter=True) \
                     .join(models.SupplierInvoice.items, isouter=True) \
                     .join(models.ClientInvoice.items, isouter=True) \
                     .filter(
                         (models.Contract.contract_code.ilike(f"%{keyword}%")) |
                         (models.SupplierInvoice.invoice_code.ilike(f"%{keyword}%")) |
                         (models.ClientInvoice.invoice_code.ilike(f"%{keyword}%")) |
                         (models.SupplierInvoice.supplier_name.ilike(f"%{keyword}%")) |
                         (models.ClientInvoice.client_name.ilike(f"%{keyword}%")) |
                         (models.SupplierInvoiceItem.product_code.ilike(f"%{keyword}%")) |
                         (models.ClientInvoiceItem.product_code.ilike(f"%{keyword}%"))
                     ).distinct()

    results = query.offset(skip).limit(limit).all()

    if not results and q and q.strip() != "":
        results = _base_contract_query(db).order_by(models.Contract.id.desc()).limit(limit).all()

    return results

# ---------------------------------------------------------------------------
# GET /contracts/{id} (Xem chi tiết hợp đồng)
# ---------------------------------------------------------------------------
@router.get("/{contract_id}", response_model=schemas.ContractResponse)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    Xem chi tiết thông tin của một hợp đồng kèm theo thông tin chi tiết hóa đơn.
    """
    contract = _base_contract_query(db).filter(models.Contract.id == contract_id).first()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hợp đồng id={contract_id}"
        )
    
    return contract


from sqlalchemy import or_

# ---------------------------------------------------------------------------
# GET /contracts/ (Xem danh sách hợp đồng kèm phân trang)
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[schemas.ContractResponse])
def list_contracts(
    pay_status: Optional[str] = Query(None, description="Lọc theo trạng thái thanh toán"),
    supplier_invoice_id: Optional[int] = Query(None, description="Tìm theo ID hóa đơn NCC"),
    client_invoice_id: Optional[int] = Query(None, description="Tìm theo ID hóa đơn Khách hàng"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách các hợp đồng hiện có trong cơ sở dữ liệu.
    """
    query = _base_contract_query(db)

    if pay_status:
        query = query.filter(
            or_(
                models.Contract.payment_status_supplier.ilike(f"%{pay_status}%"),
                models.Contract.payment_status_customer.ilike(f"%{pay_status}%")
            )
        )
    if supplier_invoice_id:
        query = query.filter(models.Contract.supplier_invoice_id == supplier_invoice_id)
    if client_invoice_id:
        query = query.filter(models.Contract.client_invoice_id == client_invoice_id)

    return query.offset(skip).limit(limit).all()


