"""
api/clients.py
--------------
Router xử lý toàn bộ logic liên quan đến Khách hàng / Bên mua (Clients).
Prefix: /clients
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("/", response_model=List[schemas.Client])
def get_clients(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> List[models.Client]:
    """
    Trả về danh sách tất cả khách hàng.

    Params:
        skip  : Số bản ghi bỏ qua (phân trang).
        limit : Số bản ghi tối đa trả về.
    """
    return db.query(models.Client).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.Client, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: schemas.ClientCreate,
    db: Session = Depends(get_db),
) -> models.Client:
    """
    Tạo mới một khách hàng.

    Raise HTTP 400 nếu tax_code đã tồn tại trong database.
    """
    existing = (
        db.query(models.Client)
        .filter(models.Client.tax_code == payload.tax_code)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Khách hàng với mã số thuế '{payload.tax_code}' đã tồn tại.",
        )

    client = models.Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client