from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from app.api.deps import get_db, get_current_user, require_roles
from app.models.instructor import Instructor
from app.models.user import User
from app.schemas.instructor import InstructorCreate, InstructorUpdate, InstructorOut

router = APIRouter()

@router.get("/", response_model=List[InstructorOut])
async def list_instructors(db: Session = Depends(get_db)):
    """Get all instructors"""
    result = await db.execute(select(Instructor).order_by(Instructor.created_at.desc()))
    return result.scalars().all()

@router.post("/", response_model=InstructorOut, status_code=status.HTTP_201_CREATED)
async def create_instructor(
    data: InstructorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin", "admin")),
):
    """Create a new instructor (Admin only)"""
    new_inst = Instructor(**data.model_dump())
    db.add(new_inst)
    try:
        await db.commit()
        await db.refresh(new_inst)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create instructor")
    return new_inst

@router.get("/{instructor_id}", response_model=InstructorOut)
async def get_instructor(instructor_id: UUID, db: Session = Depends(get_db)):
    """Get a single instructor"""
    result = await db.execute(select(Instructor).where(Instructor.id == instructor_id))
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return inst

@router.patch("/{instructor_id}", response_model=InstructorOut)
async def update_instructor(
    instructor_id: UUID,
    data: InstructorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin", "admin")),
):
    """Update an instructor (Admin only)"""
    result = await db.execute(select(Instructor).where(Instructor.id == instructor_id))
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Instructor not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(inst, key, value)
        
    try:
        await db.commit()
        await db.refresh(inst)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update instructor")
    return inst

@router.delete("/{instructor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instructor(
    instructor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("super_admin", "admin")),
):
    """Delete an instructor (Admin only)"""
    result = await db.execute(select(Instructor).where(Instructor.id == instructor_id))
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Instructor not found")
        
    await db.delete(inst)
    await db.commit()
    return None
