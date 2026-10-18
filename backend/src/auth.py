"""JWT creation and validation for the backend's access-token cookie."""

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 7 * 24 * 60


def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET_KEY")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY must be set in the backend environment.")
    return secret


def create_access_token(user_email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_email,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def get_current_user(access_token: str | None) -> str:
    """Return the authenticated user's email or raise 401 for an invalid token."""
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not logged in")

    try:
        payload = jwt.decode(
            access_token,
            _jwt_secret(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject:
            raise jwt.InvalidTokenError("Missing subject")
        return subject
    except (jwt.PyJWTError, RuntimeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        ) from None
