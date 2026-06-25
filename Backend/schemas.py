"""
schemas.py
----------
Pydantic V2 models để validate dữ liệu request từ Frontend
và serialize dữ liệu response trả về.

Quy ước đặt tên:
    - *Base   : Các trường dữ liệu dùng chung.
    - *Create : Schema nhận dữ liệu từ client (POST/PUT).
    - *       : Schema trả về cho client (có thêm id, nested objects).
"""

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional, Literal

from pydantic import BaseModel, ConfigDict


# ===========================================================================
# 1. CLIENT
# ===========================================================================

class ClientBase(BaseModel):
    name: str
    tax_code: str
    address: str
    contact_info: Optional[str] = None


class ClientCreate(ClientBase):
    pass


class Client(ClientBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# 2. SUPPLIER
# ===========================================================================

class SupplierBase(BaseModel):
    name: str
    default_template_config: Optional[Dict[str, Any]] = None


class SupplierCreate(SupplierBase):
    pass


class Supplier(SupplierBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# 3. INVOICE ITEMS
# ===========================================================================

class InvoiceItemBase(BaseModel):
    """Các trường dùng chung cho Item của cả Supplier và Client"""
    product_code: Optional[str] = None
    base_price: Optional[float] = None
    quantity: Optional[float] = None
    note: Optional[str] = "no info"
    extra_data: Optional[Dict[str, Any]] = None
    customFields: Optional[List[Dict[str, Any]]] = []



class InvoiceItemCreate(InvoiceItemBase):
    """Schema chung dùng trong lúc tạo mới Hóa đơn"""
    pass


class SupplierInvoiceItem(InvoiceItemBase):
    """Schema trả về cho Item của Supplier"""
    id: int
    invoice_id: int
    model_config = ConfigDict(from_attributes=True)


class ClientInvoiceItem(InvoiceItemBase):
    """Schema trả về cho Item của Client"""
    id: int
    invoice_id: int
    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# 4. INVOICES (CREATE - DÙNG CHUNG)
# ===========================================================================

class InvoiceCreate(BaseModel):
    invoice_type: Optional[Literal["supplier", "client"]] = None
    
    # --- Các trường chung / Client ---
    invoice_code: Optional[str] = None
    quotation_id: Optional[str] = None # Map với invoice_code của client
    
    date: Optional[datetime.date] = None
    date_quotation: Optional[datetime.date] = None # Map với date của client
    
    status: Optional[str] = "pending"
    payment_method: Optional[str] = "no info"
    currency: Optional[str] = "USD"
    
    # Khách hàng (Client)
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    client_pdf_file_path: Optional[str] = None
    total_amount_CIF: Optional[float] = None # Map chung lượng tiền
    
    # Nhà cung cấp (Supplier)
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    # client: Optional[str] = "No name recorded" # Trường client của SupplierInvoice
    suppliers_pdf_file_path: Optional[str] = None
    note: Optional[str] = None
    
    customFields: Optional[List[Dict[str, Any]]] = []
    items: List[InvoiceItemCreate] = []



# ===========================================================================
# 5. INVOICES (RESPONSE - TÁCH RIÊNG ĐỂ TRẢ VỀ)
# ===========================================================================

class SupplierInvoiceBase(BaseModel):
    invoice_code: str
    supplier_id: int 
    # client: Optional[str] = None
    date: Optional[datetime.date] = None
    total_amount_CIF: Optional[float] = None
    suppliers_pdf_file_path: Optional[str] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None
    note: Optional[str] = None

class SupplierInvoice(SupplierInvoiceBase):
    """Data trả về cho Hóa đơn Nhà cung cấp (Bao gồm thông tin NCC và Items)"""
    id: int
    supplier: Optional[Supplier] = None
    items: List[SupplierInvoiceItem] = []
    
    model_config = ConfigDict(from_attributes=True)

class SupplierInvoiceResponse(BaseModel):
    id: int
    invoice_code: str
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    # client: Optional[str] = None
    date: Optional[datetime.date] = None
    total_amount_CIF: Optional[float] = None
    suppliers_pdf_file_path: Optional[str] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None
    note: Optional[str] = None
    currency: Optional[str] = None
    customFields: Optional[List[Dict[str, Any]]] = None
    items: List[SupplierInvoiceItem] = []
    model_config = ConfigDict(from_attributes=True)


class ClientInvoiceBase(BaseModel):
    invoice_code: str
    client_id: int
    date: Optional[datetime.date] = None
    total_amount_CIF: Optional[float] = None
    clients_pdf_file_path: Optional[str] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None

class ClientInvoice(ClientInvoiceBase):
    """Data trả về cho Hóa đơn Khách hàng (Bao gồm thông tin Khách hàng và Items)"""
    id: int
    client: Optional[Client] = None
    items: List[ClientInvoiceItem] = []
    
    model_config = ConfigDict(from_attributes=True)



class ClientInvoiceResponse(BaseModel):
    id: int
    invoice_code: str
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    # supplier_name: Optional[str] = None
    date: Optional[datetime.date] = None
    total_amount_CIF: Optional[float] = None
    clients_pdf_file_path: Optional[str] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None
    currency: Optional[str] = None
    customFields: Optional[List[Dict[str, Any]]] = None
    items: List[ClientInvoiceItem] = []
    model_config = ConfigDict(from_attributes=True)
# ===========================================================================
# 6. CONTRACTS
# ===========================================================================

class ContractBase(BaseModel):
    # ─── BỔ SUNG TRƯỜNG NÀY ───
    contract_code: str  # Mã hợp đồng tự nhập, bắt buộc khi tạo
    date: Optional[datetime.date] = None
    supplier_invoice_id: int
    client_invoice_id: int
    
    commission: Optional[float] = 0.0
    negotiation_margin: Optional[float] = 0.0
    profits: Optional[float] = None
    currency: str = "VND"
    discount: float = 0.0
    
    # Thêm các trường mới
    receiver: Optional[str] = None
    status: Optional[str] = None
    payment_status: Optional[Literal["paid", "not yet paid", "paid 50%"]] = "not yet paid"
    
    payment_status_supplier: Optional[Literal["paid", "not yet paid", "paid 50%"]] = "not yet paid"
    payment_status_customer: Optional[Literal["paid", "not yet paid", "paid 50%"]] = "not yet paid"
    nego_margin: Optional[float] = 0.0
    supplier_discount: Optional[float] = 0.0
    customer_discount: Optional[float] = 0.0
    na_col: Optional[float] = 0.0
    
    note: Optional[str] = None
    sc: bool = False
    sc_no: Optional[str] = None
    customFields: Optional[List[Dict[str, Any]]] = []


class ContractCreate(ContractBase):
    """Dùng khi tạo mới hợp đồng (POST /contracts/)"""
    pass


class ContractUpdate(BaseModel):
    # ─── BỔ SUNG TRƯỜNG NÀY (Nullable/Optional để tiện khi chỉ cập nhật các trường khác) ───
    contract_code: Optional[str] = None
    date: Optional[datetime.date] = None
    supplier_invoice_id: Optional[int] = None
    client_invoice_id: Optional[int] = None
    commission: Optional[float] = None
    negotiation_margin: Optional[float] = None
    profits: Optional[float] = None
    currency: Optional[str] = None
    discount: Optional[float] = None
    
    receiver: Optional[str] = None
    status: Optional[str] = None
    payment_status: Optional[Literal["paid", "not yet paid", "paid 50%"]] = None
    
    payment_status_supplier: Optional[Literal["paid", "not yet paid", "paid 50%"]] = None
    payment_status_customer: Optional[Literal["paid", "not yet paid", "paid 50%"]] = None
    nego_margin: Optional[float] = None
    supplier_discount: Optional[float] = None
    customer_discount: Optional[float] = None
    na_col: Optional[float] = None
    
    note: Optional[str] = None
    sc: Optional[bool] = None
    sc_no: Optional[str] = None
    customFields: Optional[List[Dict[str, Any]]] = None


class ContractResponse(ContractBase):
    """
    Schema trả về cho client. 
    Kèm theo 2 object hóa đơn đã được join từ cơ sở dữ liệu.
    """
    id: int
    supplier_invoice: Optional[SupplierInvoiceResponse] = None
    client_invoice: Optional[ClientInvoiceResponse] = None
    
    model_config = ConfigDict(from_attributes=True)