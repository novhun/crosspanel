from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.models.user import User
from app.services.auth_service import AuthService
from app.controllers.auth_controller import get_current_user

router = APIRouter(prefix="/users", tags=["User Management"])

class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    display_name: Optional[str] = None
    role: str = "Operator"  # Administrator, Operator, Developer, Viewer
    status: str = "active"  # active, disabled

class UpdateUserRequest(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

class ResetUserPasswordRequest(BaseModel):
    new_password: str


@router.get("")
async def list_users(db: AsyncSession = Depends(get_db)):
    """List all real users in the CrossPanel system."""
    result = await db.execute(select(User).order_by(User.id.asc()))
    users = result.scalars().all()
    return [u.to_dict() for u in users]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    req: CreateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user in the system with encrypted password."""
    # Check username uniqueness
    u_chk = await db.execute(select(User).where(User.username == req.username.strip()))
    if u_chk.scalars().first():
        raise HTTPException(status_code=400, detail="Username already exists")

    # Check email uniqueness
    e_chk = await db.execute(select(User).where(User.email == str(req.email).strip()))
    if e_chk.scalars().first():
        raise HTTPException(status_code=400, detail="Email address is already in use")

    new_user = User(
        username=req.username.strip(),
        email=str(req.email).strip(),
        display_name=req.display_name or req.username.strip(),
        password_hash=AuthService.hash_password(req.password),
        role=req.role if req.role in ["Administrator", "Operator", "Developer", "Viewer"] else "Operator",
        status=req.status if req.status in ["active", "disabled"] else "active",
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return {
        "success": True,
        "message": f"User {new_user.username} created successfully.",
        "user": new_user.to_dict()
    }


@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.to_dict()


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    req: UpdateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.display_name is not None:
        user.display_name = req.display_name
    if req.email is not None:
        e_chk = await db.execute(select(User).where(User.email == str(req.email), User.id != user_id))
        if e_chk.scalars().first():
            raise HTTPException(status_code=400, detail="Email is already used by another account")
        user.email = str(req.email)
    if req.role is not None:
        if req.role in ["Administrator", "Operator", "Developer", "Viewer"]:
            user.role = req.role
    if req.status is not None:
        if req.status in ["active", "disabled"]:
            # Prevent disabling self
            if current_user.id == user.id and req.status == "disabled":
                raise HTTPException(status_code=400, detail="You cannot disable your own administrator account.")
            user.status = req.status

    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    return {
        "success": True,
        "message": f"User {user.username} updated successfully.",
        "user": user.to_dict()
    }


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    req: ResetUserPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not req.new_password or len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    user.password_hash = AuthService.hash_password(req.new_password)
    user.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "success": True,
        "message": f"Password for user {user.username} has been reset successfully."
    }


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    # Check if this is the only administrator
    if user.role == "Administrator":
        admin_count_res = await db.execute(select(User).where(User.role == "Administrator", User.id != user.id))
        if not admin_count_res.scalars().first():
            raise HTTPException(status_code=400, detail="Cannot delete the only administrator account.")

    await db.delete(user)
    await db.commit()

    return {
        "success": True,
        "message": f"User {user.username} has been deleted."
    }
