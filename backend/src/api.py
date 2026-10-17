"""
This file defines the FastAPI app for the API and all of its routes.
To run this API, use the FastAPI CLI
$ fastapi dev src/api.py
"""

# api.py
import re
from typing import Any
from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

UCI_EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@uci\.edu$", re.IGNORECASE)


db_users: dict[str, dict[str, Any]] = {}


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
            raise ValueError("Must be a valid @uci.edu email")
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


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_email: str) -> str:
    """Mock access token generator."""
    return f"mock-token-for-{user_email}"



app = FastAPI()


@app.get("/users")
async def get_users() -> list[dict[str, Any]]:
    """Get a list of all registered users (excluding passwords)."""
    return [
        {"name": u["name"], "email": u["email"]} 
        for u in db_users.values()
    ]


@app.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate, response: Response) -> dict[str, str]:
    """Handles frontend signup request from SignupForm.jsx"""
    if user.email in db_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists."
        )

    # Store user data
    db_users[user.email] = {
        "name": user.name,
        "email": user.email,
        "password": user.hash_password(user.password),  # Note: Hash passwords using passlib/bcrypt in production
    }

    # Generate token & set cookie
    token = create_access_token(user_email=user.email)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=900,
    )

    return {"message": "User created successfully"}


@app.post("/login", status_code=status.HTTP_200_OK)
async def login(credentials: UserLogin, response: Response) -> dict[str, str]:
    """Handles frontend login request from LoginForm.jsx"""
    existing_user = db_users.get(credentials.email)
    

    if not existing_user or not verify_password(credentials.password, existing_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login failed. Check your credentials."
        )

    # Generate token & set cookie
    token = create_access_token(user_email=credentials.email)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=900,
    )

    return {"message": "Logged in successfully"}