import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.user import User, ApiToken, AuthSession

JWT_SECRET = settings.SECRET_KEY or "crosspanel-secret-dev-key-change-in-prod"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

class AuthService:

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using PBKDF2-HMAC-SHA256 with 200,000 iterations and salt."""
        salt = secrets.token_hex(16)
        iterations = 200000
        key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations
        )
        return f"pbkdf2_sha256${iterations}${salt}${key.hex()}"

    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verify a password against a PBKDF2-HMAC-SHA256 hash or legacy/plain fallback."""
        if not hashed:
            return False
        try:
            parts = hashed.split("$")
            if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
                iterations = int(parts[1])
                salt = parts[2]
                expected_key = parts[3]
                test_key = hashlib.pbkdf2_hmac(
                    "sha256",
                    password.encode("utf-8"),
                    salt.encode("utf-8"),
                    iterations
                ).hex()
                return secrets.compare_digest(test_key, expected_key)
            elif hashed == password:
                # Plaintext fallback for migration
                return True
        except Exception:
            return False
        return False

    @staticmethod
    def create_jwt_token(user: User, expires_delta: Optional[timedelta] = None) -> str:
        """Generate a signed JWT Bearer access token."""
        delta = expires_delta or timedelta(days=JWT_EXPIRATION_DAYS)
        expire = datetime.utcnow() + delta
        jti = secrets.token_hex(16)
        payload = {
            "sub": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "jti": jti,
            "exp": expire,
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    @staticmethod
    def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
        """Decode and validate a JWT Bearer access token."""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return payload
        except Exception:
            return None

    @staticmethod
    def generate_api_key(prefix: str = "cp_live_") -> str:
        """Generate a secure API key with standard prefix."""
        random_part = secrets.token_urlsafe(32).replace("-", "").replace("_", "")[:32]
        return f"{prefix}{random_part}"

    @classmethod
    async def ensure_default_admin(cls, db: AsyncSession):
        """Seed default admin user if database is empty."""
        try:
            result = await db.execute(select(User))
            existing_user = result.scalars().first()
            if not existing_user:
                admin = User(
                    username="admin",
                    email="admin@crosspanel.internal",
                    display_name="Nov Hun",
                    password_hash=cls.hash_password("admin123"),
                    role="Administrator",
                    status="active",
                    created_at=datetime.utcnow()
                )
                db.add(admin)
                await db.commit()
                await db.refresh(admin)

                # Add sample team users for demonstration
                op = User(
                    username="operator",
                    email="operator@crosspanel.internal",
                    display_name="DevOps Operator",
                    password_hash=cls.hash_password("operator123"),
                    role="Operator",
                    status="active",
                    created_at=datetime.utcnow()
                )
                viewer = User(
                    username="viewer",
                    email="viewer@crosspanel.internal",
                    display_name="Audit Viewer",
                    password_hash=cls.hash_password("viewer123"),
                    role="Viewer",
                    status="disabled",
                    created_at=datetime.utcnow()
                )
                db.add_all([op, viewer])
                await db.commit()
                print("[Auth Service] Seeded default administrator (admin / admin123).")
        except Exception as e:
            await db.rollback()
            print(f"[Auth Service Error] Seed default admin: {e}")
