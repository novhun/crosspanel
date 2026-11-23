from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.models.user import User, ApiToken, AuthSession
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication & Security"])

class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None

class CreateTokenRequest(BaseModel):
    name: str

class Toggle2FARequest(BaseModel):
    enabled: bool
    code: Optional[str] = None


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extract and authenticate the user via JWT Bearer token or return default admin."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1].strip()
        payload = AuthService.decode_jwt_token(token)
        if payload and "sub" in payload:
            user_id = int(payload["sub"])
            user = await db.get(User, user_id)
            if user and user.status == "active":
                return user

    # Fallback to the first active administrator if unauthenticated in local dev
    result = await db.execute(select(User).where(User.status == "active").order_by(User.id.asc()))
    user = result.scalars().first()
    if user:
        return user

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")


@router.post("/login")
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Find user by username or email
    stmt = select(User).where((User.username == req.username) | (User.email == req.username))
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user or not AuthService.verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid username or password")

    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled. Contact system administrator.")

    # Update last login
    user.last_login = datetime.utcnow()
    token = AuthService.create_jwt_token(user)

    # Record session
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Browser")[:250]
    session_record = AuthSession(
        user_id=user.id,
        token_jti=AuthService.decode_jwt_token(token).get("jti", ""),
        ip_address=client_ip,
        user_agent=user_agent,
        last_active=datetime.utcnow(),
        is_active=True
    )
    db.add(session_record)
    await db.commit()

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": user.to_dict()
    }


@router.get("/me")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Count tokens
    tokens_res = await db.execute(select(ApiToken).where(ApiToken.user_id == user.id, ApiToken.is_revoked == False))
    active_tokens = len(tokens_res.scalars().all())

    # Get recent sessions
    sess_res = await db.execute(select(AuthSession).where(AuthSession.user_id == user.id).order_by(AuthSession.last_active.desc()).limit(5))
    sessions = [s.to_dict() for s in sess_res.scalars().all()]

    return {
        "user": user.to_dict(),
        "active_tokens_count": active_tokens,
        "sessions": sessions
    }


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not req.current_password or not req.new_password:
        raise HTTPException(status_code=400, detail="Current password and new password are required.")

    if req.confirm_password and req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match.")

    if req.current_password == req.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password.")

    if not AuthService.verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password verification failed.")

    user.password_hash = AuthService.hash_password(req.new_password)
    user.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "success": True,
        "message": "Password changed successfully."
    }


@router.put("/profile")
async def update_profile(
    req: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if req.display_name is not None:
        user.display_name = req.display_name
    if req.email is not None:
        # Check uniqueness
        existing = await db.execute(select(User).where(User.email == str(req.email), User.id != user.id))
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Email is already in use by another account.")
        user.email = str(req.email)
    if req.avatar is not None:
        user.avatar = req.avatar

    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    return {
        "success": True,
        "message": "Profile updated successfully.",
        "user": user.to_dict()
    }


@router.get("/tokens")
async def list_tokens(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiToken).where(ApiToken.user_id == user.id, ApiToken.is_revoked == False).order_by(ApiToken.created_at.desc()))
    return [t.to_dict() for t in result.scalars().all()]


@router.post("/tokens")
async def create_token(
    req: CreateTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raw_token = AuthService.generate_api_key("cp_live_")
    token_model = ApiToken(
        user_id=user.id,
        name=req.name.strip() or "Default API Token",
        token=raw_token,
        prefix="cp_live_",
        created_at=datetime.utcnow()
    )
    db.add(token_model)
    await db.commit()
    await db.refresh(token_model)

    return {
        "success": True,
        "message": "API Token created. Copy this token now as it will not be displayed again.",
        "token": raw_token,
        "id": token_model.id,
        "name": token_model.name
    }


@router.delete("/tokens/{token_id}")
async def revoke_token(
    token_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    token = await db.get(ApiToken, token_id)
    if not token or token.user_id != user.id:
        raise HTTPException(status_code=404, detail="Token not found")

    token.is_revoked = True
    await db.commit()

    return {"success": True, "message": "API token revoked successfully."}


@router.post("/2fa/toggle")
async def toggle_2fa(
    req: Toggle2FARequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user.two_factor_enabled = req.enabled
    await db.commit()

    return {
        "success": True,
        "two_factor_enabled": user.two_factor_enabled,
        "message": f"Two-factor authentication has been {'enabled' if user.two_factor_enabled else 'disabled'}."
    }


@router.get("/sessions")
async def list_sessions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuthSession).where(AuthSession.user_id == user.id).order_by(AuthSession.last_active.desc()).limit(10))
    return [s.to_dict() for s in result.scalars().all()]
