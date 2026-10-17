"""
This file defines the FastAPI app for the API and all of its routes.
To run this API, use the FastAPI CLI
$ fastapi dev src/api.py
"""

# api.py
import re
from typing import Any
from fastapi import Cookie, FastAPI, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, field_validator
from passlib.context import CryptContext
from mailer import send_verification_email, verify_token
from auth import ACCESS_TOKEN_MINUTES, create_access_token, get_current_user as validate_access_token
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
# Initialize Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://sczhtmnffsvgwsxgyugt.supabase.co/")
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


UCI_EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", re.IGNORECASE)



class UserCreate(BaseModel):
    name: str
    email: str
    password: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name is required")
        return value

    @field_validator("email")
    @classmethod
    def validate_uci_email(cls, value: str) -> str:
        if UCI_EMAIL_PATTERN.fullmatch(value) is None:
            raise ValueError("Must be a valid email")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters")
        return value


class UserLogin(BaseModel):
    email: str
    password: str


class ResendVerification(BaseModel):
    email: str


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

app = FastAPI()


@app.get("/auth/me")
async def current_user(access_token: str | None = Cookie(default=None)) -> dict[str, str]:
    """Validate the access-token cookie and return its authenticated subject."""
    email = validate_access_token(access_token)
    return {"email": email}


@app.get("/users")
async def get_users() -> list[dict[str, Any]]:
    """Get a list of all registered users (excluding passwords)."""
    res = supabase.table("users").select("name, email").execute()
    return res.data


@app.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate) -> dict[str, str]:
    """Handles frontend signup request from SignupForm.jsx"""
    res = supabase.table("users").select("email").eq("email", user.email).execute()
    if res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists."
        )

    # Insert new user
    supabase.table("users").insert({
        "name": user.name,
        "email": user.email,
        "password": hash_password(user.password),
        "is_verified": False,
    }).execute()

    send_verification_email(email=user.email, name=user.name)

    return {"message": "Check your email to verify your account."}


@app.get("/verify-email")
async def verify_email(token: str) -> dict[str, str]:
    email = verify_token(token)
    res = supabase.table("users").select("*").eq("email", email or "").execute()
    user = res.data[0] if res.data else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link is invalid or has already been used.",
        )

    supabase.table("users").update({"is_verified": True}).eq("email", email).execute()
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)


@app.post("/resend-verification")
async def resend_verification(user: ResendVerification) -> dict[str, str]:
    res = supabase.table("users").select("name, is_verified").eq("email", user.email).execute()
    existing_user = res.data[0] if res.data else None
    if not existing_user:
        raise HTTPException(status_code=404, detail="No account found for that email.")
    if existing_user.get("is_verified"):
        raise HTTPException(status_code=400, detail="This account is already verified.")

    send_verification_email(email=user.email, name=existing_user["name"])
    return {"message": "Verification email sent."}


@app.post("/login", status_code=status.HTTP_200_OK)
async def login(credentials: UserLogin, response: Response) -> dict[str, str]:
    """Handles frontend login request from LoginForm.jsx"""
    res = supabase.table("users").select("*").eq("email", credentials.email).execute()
    existing_user = res.data[0] if res.data else None

    if not existing_user or not verify_password(credentials.password, existing_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login failed. Check your credentials."
        )

    if not existing_user.get("is_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email before logging in.",
        )

    # Generate token & set cookie
    token = create_access_token(user_email=credentials.email)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_MINUTES * 60,
    )

    return {"message": "Logged in successfully"}
