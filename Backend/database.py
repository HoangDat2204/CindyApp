"""
database.py
-----------
Thiết lập kết nối SQLAlchemy với SQLite cho dự án SmartEntry OCR.
Cung cấp engine, session factory, Base declarative và dependency get_db() cho FastAPI.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import Generator

# Đường dẫn tới file SQLite (tương đối từ thư mục backend/)
SQLALCHEMY_DATABASE_URL = "sqlite:///../database/storage.db"

# Khởi tạo engine.
# check_same_thread=False bắt buộc với SQLite để hỗ trợ đa luồng trong FastAPI.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Session factory — mỗi request FastAPI sẽ tạo một SessionLocal riêng.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class dùng để kế thừa trong models.py
Base = declarative_base()


def get_db() -> Generator:
    """
    FastAPI dependency để cấp phát DB session cho mỗi request.

    Sử dụng yield để đảm bảo session luôn được đóng sau khi request hoàn tất,
    kể cả khi có exception xảy ra.

    Cách dùng trong router:
        def my_endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()