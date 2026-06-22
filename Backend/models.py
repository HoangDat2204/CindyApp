"""
models.py
---------
Định nghĩa các ORM models (ánh xạ Python class <-> bảng SQLite)
cho dự án SmartEntry OCR.

Các bảng:
    - clients              : Thông tin công ty / người mua.
    - suppliers            : Thông tin nhà cung cấp.
    - supplier_invoices    : Bảng chào giá / hóa đơn đầu vào từ Supplier.
    - supplier_invoice_items: Chi tiết dòng sản phẩm của Supplier Invoice.
    - client_invoices      : Bảng chào giá / hóa đơn đầu ra cho Client.
    - client_invoice_items : Chi tiết dòng sản phẩm của Client Invoice.
    - contracts            : Hợp đồng lưu thông tin chốt đơn giữa 2 bên.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    ForeignKey,
    JSON,
    Boolean,  # <--- Thêm dòng này vào import
)

from sqlalchemy.orm import relationship

from database import Base


class Client(Base):
    """Bảng clients — lưu thông tin công ty / người mua hàng."""
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    tax_code = Column(String, unique=True, nullable=False)
    address = Column(String, nullable=False)
    contact_info = Column(String, nullable=True)

    # Relationship: 1 Client có nhiều Client Invoices
    client_invoices = relationship("ClientInvoice", back_populates="client")

    def __repr__(self) -> str:
        return f"<Client id={self.id} name={self.name!r} tax_code={self.tax_code!r}>"


class Supplier(Base):
    """Bảng suppliers — lưu thông tin nhà cung cấp."""
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    default_template_config = Column(JSON, nullable=True)

    # Relationship: 1 Supplier có nhiều Supplier Invoices
    supplier_invoices = relationship("SupplierInvoice", back_populates="supplier")

    def __repr__(self) -> str:
        return f"<Supplier id={self.id} name={self.name!r}>"


# ==========================================
# PHẦN SUPPLIER INVOICE & ITEMS
# ==========================================

class SupplierInvoice(Base):
    """Hóa đơn / Bảng chào giá đầu vào từ nhà cung cấp"""
    __tablename__ = "supplier_invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_code = Column(String, nullable=False, unique=True, comment="Số hóa đơn (hoặc mã chào giá)") 
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True) # Đổi thành nullable=True để tương thích khi ID là null
    supplier_name = Column(String, nullable=True, comment="Tên nhà cung cấp tạm thời") # Bổ sung cột này
    date = Column(Date, nullable=True, comment="Ngày lập hóa đơn")
    total_amount_CIF = Column(Float, nullable=True)
    suppliers_pdf_file_path = Column(String, nullable=True, comment="Đường dẫn PDF phía NCC")
    status = Column(String, default="pending", comment="Trạng thái: pending | verified | …")
    payment_method = Column(String, default="no info", comment="Phương thức thanh toán")
    note = Column(String, nullable=True , comment="Ghi chú hóa đơn NCC")
    # client = Column(String, default="No client extracted", comment="Tên của khách hàng")
    currency = Column(String, default="USD", comment="giá trị tiền tệ của hóa đơn")

    customFields = Column(JSON, nullable=True, default=list, comment="Các trường tùy chỉnh (List of dicts)")

    # Relationships
    supplier = relationship("Supplier", back_populates="supplier_invoices")
    items = relationship(
        "SupplierInvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )
    contract = relationship("Contract", back_populates="supplier_invoice", uselist=False, cascade="all, delete-orphan")


class SupplierInvoiceItem(Base):
    """Chi tiết sản phẩm trong hóa đơn của nhà cung cấp"""
    __tablename__ = "supplier_invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("supplier_invoices.id"), nullable=False)
    product_code = Column(String, nullable=True, comment="Mã sản phẩm")
    base_price = Column(Float, nullable=True, comment="Đơn giá")
    quantity = Column(Float, nullable=True, comment="Số lượng")
    note = Column(String, default="no info", comment="Ghi chú về sản phẩm")
    extra_data = Column(JSON, nullable=True, comment="Dữ liệu tùy biến: hạn SD, quy cách...")
    customFields = Column(JSON, nullable=True, default=list, comment="Các trường tùy chỉnh (List of dicts)")
    invoice = relationship("SupplierInvoice", back_populates="items")
    


# ==========================================
# PHẦN CLIENT INVOICE & ITEMS
# ==========================================

class ClientInvoice(Base):
    """Hóa đơn / Bảng chào giá đầu ra cho khách hàng"""
    __tablename__ = "client_invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_code = Column(String, nullable=False, unique=True, comment="Số hóa đơn")
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True) # Đổi thành nullable=True
    client_name = Column(String, nullable=True, comment="Tên khách hàng tạm thời") # Bổ sung cột này
    # supplier_name = Column(String, nullable=True, comment="Tên nhà cung cấp tạm thời") # Bổ sung cột này
    date = Column(Date, nullable=True, comment="Ngày lập hóa đơn")
    total_amount_CIF = Column(Float, nullable=True)
    clients_pdf_file_path = Column(String, nullable=True, comment="Đường dẫn PDF phía khách hàng")
    status = Column(String, default="pending", comment="Trạng thái")
    payment_method = Column(String, default="no info", comment="Phương thức thanh toán")
    currency = Column(String, default="USD", comment="Loại tiền tệ") # Bổ sung cột currency cho ClientInvoice
    customFields = Column(JSON, nullable=True, default=list) # Bổ sung customFields cho ClientInvoice

    # Relationships
    client = relationship("Client", back_populates="client_invoices")
    items = relationship(
        "ClientInvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )
    contract = relationship("Contract", back_populates="client_invoice", uselist=False, cascade="all, delete-orphan")



class ClientInvoiceItem(Base):
    """Chi tiết sản phẩm trong hóa đơn của khách hàng"""
    __tablename__ = "client_invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("client_invoices.id"), nullable=False)
    product_code = Column(String, nullable=True, comment="Mã sản phẩm")
    base_price = Column(Float, nullable=True, comment="Đơn giá")
    quantity = Column(Float, nullable=True, comment="Số lượng")
    note = Column(String, default="no info", comment="Ghi chú về sản phẩm")
    extra_data = Column(JSON, nullable=True, comment="Dữ liệu tùy biến: hạn SD, quy cách...")
    customFields = Column(JSON, nullable=True, default=list, comment="Các trường tùy chỉnh (List of dicts)")
    invoice = relationship("ClientInvoice", back_populates="items")


# ==========================================
# PHẦN HỢP ĐỒNG (CONTRACTS)
# ==========================================

class Contract(Base):
    """
    Bảng contracts — Hợp đồng lưu các đơn đã chốt giữa Client và Supplier
    """
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # ─── BỔ SUNG TRƯỜNG NÀY ───
    contract_code = Column(String, nullable=False, unique=True, comment="Mã hợp đồng tự nhập") 
    date = Column(Date, nullable=True, comment="Ngày chốt hợp đồng")
    
    # FK nối tới 2 bảng hóa đơn
    supplier_invoice_id = Column(Integer, ForeignKey("supplier_invoices.id"), nullable=False, unique=True)
    client_invoice_id = Column(Integer, ForeignKey("client_invoices.id"), nullable=False, unique=True)
    
    # Các thông số về tài chính / hoa hồng
    commission = Column(Float, nullable=True, default=0.0, comment="Giá trị hoa hồng (%)")
    negotiation_margin = Column(Float, nullable=True, default=0.0, comment="Giá trị tiền lời tham khảo (%)")
    profits = Column(Float, nullable=True, comment="Giá trị tiền lời của hợp đồng")
    currency = Column(String, nullable=True, default="VND", comment="Giá trị tiền tệ của tiền lời")
    discount = Column(Float, nullable=True, default=0.0, comment="Giá trị đơn hàng discount cho khách")
    
    # Các trường mới theo yêu cầu nghiệp vụ
    receiver = Column(String, nullable=True, comment="Người nhận bảng chào")
    status = Column(String, nullable=True, comment="Trạng thái hợp đồng")
    payment_status = Column(String, default="not yet paid", comment="Trạng thái thanh toán: paid | not yet paid | paid 50%")
    
    # Chia trạng thái thanh toán làm 2 trường
    payment_status_supplier = Column(String, default="not yet paid", comment="Trạng thái mình thanh toán cho Supplier")
    payment_status_customer = Column(String, default="not yet paid", comment="Trạng thái Khách hàng thanh toán cho mình")
    
    # Các trường discount/margin mới
    nego_margin = Column(Float, nullable=True, default=0.0, comment="Nego margin (%)")
    supplier_discount = Column(Float, nullable=True, default=0.0, comment="Supplier discount")
    customer_discount = Column(Float, nullable=True, default=0.0, comment="Customer discount")
    na_col = Column(Float, nullable=True, default=0.0, comment="NA Column")
    
    note = Column(String, nullable=True, comment="Ghi chú cho hợp đồng")
    
    sc = Column(Boolean, default=False, comment="Giá trị SC (default là False/NO)")
    sc_no = Column(String, nullable=True, comment="Mã số SC")
    customFields = Column(JSON, nullable=True, default=list, comment="Các trường bổ sung dạng JSON")

    # Relationships ngược về hóa đơn (Sử dụng back_populates để truy xuất 2 chiều)
    supplier_invoice = relationship("SupplierInvoice", back_populates="contract")
    client_invoice = relationship("ClientInvoice", back_populates="contract")

    def __repr__(self) -> str:
        return f"<Contract id={self.id} date={self.date} payment_status={self.payment_status}>"