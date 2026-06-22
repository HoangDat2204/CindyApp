"""
api/suppliers.py
----------------
Router xử lý toàn bộ logic liên quan đến Nhà cung cấp (Suppliers).
Prefix: /suppliers
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("/", response_model=List[schemas.Supplier])
def get_suppliers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> List[models.Supplier]:
    """
    Trả về danh sách tất cả nhà cung cấp.

    Params:
        skip  : Số bản ghi bỏ qua (phân trang).
        limit : Số bản ghi tối đa trả về.
    """
    return db.query(models.Supplier).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.Supplier, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: schemas.SupplierCreate,
    db: Session = Depends(get_db),
) -> models.Supplier:
    """
    Tạo mới một nhà cung cấp.

    Raise HTTP 400 nếu tên đã tồn tại trong database.
    """
    existing = (
        db.query(models.Supplier)
        .filter(models.Supplier.name == payload.name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nhà cung cấp với tên '{payload.name}' đã tồn tại.",
        )

    supplier = models.Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier