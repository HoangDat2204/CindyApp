from database import engine, Base, SessionLocal
from models import Client, Supplier, Invoice, InvoiceItem
from datetime import date

# 1. Lệnh này sẽ yêu cầu SQLAlchemy quét các class trong models.py 
# và tạo ra các bảng tương ứng vào file storage.db vật lý.
print("⏳ Đang khởi tạo Database...")
Base.metadata.create_all(bind=engine)
print("✅ Khởi tạo thành công!\n")

def run_test():
    # Mở 1 phiên làm việc với database
    db = SessionLocal()
    
    try:
        print("⏳ Đang insert dữ liệu mẫu...")
        
        # 1. Tạo 1 Client (Khách hàng/Công ty của bạn)
        test_client = Client(
            name="Công ty TNHH Rucao Chi nhánh 2",
            tax_code="0123456789_V2", # <--- Thêm hậu tố hoặc đổi số khác
            address="Hà Nội",
            contact_info="rucao@example.com"
        )
        db.add(test_client)
        
        # 2. Tạo 1 Supplier (Nhà cung cấp)
        test_supplier = Supplier(
            name="Nhà Cung Cấp Văn Phòng Phẩm A",
            # Giả sử NCC này có cấu hình template bóc tách riêng
            default_template_config={"columns_mapping": {"ten_sp": "name", "gia": "base_price"}}
        )
        db.add(test_supplier)
        
        # Phải commit để lấy được ID của Client và Supplier
        db.commit() 
        db.refresh(test_client)
        db.refresh(test_supplier)

        # 3. Tạo 1 Hóa đơn liên kết với Client và Supplier trên
        test_invoice = Invoice(
            invoice_code="HD-2026-001",
            supplier_id=test_supplier.id,
            client_id=test_client.id,
            date=date.today(),
            total_amount=150000.0,
            suppliers_pdf_file_path="C:/fakepath/hoadon1.pdf",
            clients_pdf_file_path="C:/fakepath/hoadon2.pdf",
            status="verified"
        )
        db.add(test_invoice)
        db.commit()
        db.refresh(test_invoice)

        # 4. Tạo chi tiết sản phẩm (Test quan trọng nhất: Cột JSON extra_data)
        item_1 = InvoiceItem(
            invoice_id=test_invoice.id,
            product_code="SP01",
            base_price=50000.0,
            quantity=2.0,
            # Test đưa dữ liệu tùy biến vào JSON
            extra_data={
                "quy_cach": "Hộp 10 chiếc",
                "han_su_dung": "2027-12",
                "chiet_khau": "5%",
                "ghi_chu": "Hàng dễ vỡ"
            }
        )
        item_2 = InvoiceItem(
            invoice_id=test_invoice.id,
            product_code="SP02",
            base_price=50000.0,
            quantity=1.0,
            extra_data={
                "mau_sac": "Xanh dương",
                "bao_hanh": "12 tháng"
            }
        )
        db.add_all([item_1, item_2])
        db.commit()
        print("✅ Insert dữ liệu thành công!\n")

        # 5. Truy vấn ngược lại để test đọc dữ liệu
        print("🔍 BẮT ĐẦU ĐỌC DỮ LIỆU TỪ DATABASE:")
        saved_invoice = db.query(Invoice).filter(Invoice.invoice_code == "HD-2026-001").first()
        
        print(f"Hóa đơn: {saved_invoice.invoice_code}")
        print(f"Nhà cung cấp: {saved_invoice.supplier.name}") # Test relation
        print(f"Tổng tiền: {saved_invoice.total_amount}")
        print("Chi tiết các mặt hàng:")
        
        for item in saved_invoice.items: # Test relation
            print(f"  - Mã SP: {item.product_code} | Số lượng: {item.quantity} | Giá: {item.base_price}")
            print(f"    Dữ liệu JSON tùy biến: {item.extra_data}")

    except Exception as e:
        print(f"❌ Lỗi xảy ra: {e}")
        db.rollback()
    finally:
        db.close() # Luôn nhớ đóng kết nối

if __name__ == "__main__":
    run_test()