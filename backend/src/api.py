"""
This file defines the FastAPI app for the API and all of its routes.
To run this API, use the FastAPI CLI
$ fastapi dev src/api.py
"""

# api.py
import re
import random
from typing import Any
from fastapi import Cookie, FastAPI, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, field_validator
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

CARD_VALUES = {"A": 11, "K": 10, "Q": 10, "J": 10}

def card_value(card: str) -> int:
    return int(card[:-1]) if card[:-1].isdigit() else CARD_VALUES[card[0]]

def hand_value(cards: list[str]) -> int:
    total = sum(card_value(card) for card in cards)
    aces = sum(card.startswith("A") for card in cards)
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return total

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


class GambleRequest(BaseModel):
    game: str
    wager: int
    choice: int | None = None
    bet_type: str = "number"
    selected: list[int] = Field(default_factory=list)
    mines: list[int] = Field(default_factory=list)

    @field_validator("wager")
    @classmethod
    def validate_wager(cls, value: int) -> int:
        if value < 1:
            raise ValueError("Wager must be at least 1 point")
        return value


TAGS = {"free food", "free merch", "discounts", "career development"}


class UserPreferences(BaseModel):
    tags: list[str]

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, values: list[str]) -> list[str]:
        if any(tag not in TAGS for tag in values):
            raise ValueError(f"Tags must be selected from: {', '.join(sorted(TAGS))}")
        return list(dict.fromkeys(values))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

app = FastAPI()


@app.get("/auth/me")
async def current_user(access_token: str | None = Cookie(default=None)) -> dict[str, Any]:
    """Validate the access-token cookie and return its authenticated subject."""
    email = validate_access_token(access_token)
    user = supabase.table("users").select("name, score").eq("email", email).execute()
    record = user.data[0] if user.data else {}
    return {"email": email, "name": record.get("name") or "Anteater", "points": record.get("score") or 0}


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
        "tag": [],
    }).execute()

    token = send_verification_email(email=user.email, name=user.name)
    print(f"Signup verification token for {user.email}: {token}")

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
    response = RedirectResponse(url="/?verified=1", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        key="access_token",
        value=create_access_token(user_email=email),
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_MINUTES * 60,
    )
    return response


@app.patch("/users/preferences")
async def update_preferences(
    preferences: UserPreferences,
    access_token: str | None = Cookie(default=None),
) -> dict[str, list[str]]:
    email = validate_access_token(access_token)
    supabase.table("users").update({"tag": preferences.tags}).eq("email", email).execute()
    return {"tags": preferences.tags}


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


@app.post("/gamble")
async def gamble(bet: GambleRequest, access_token: str | None = Cookie(default=None)) -> dict[str, Any]:
    email = validate_access_token(access_token)
    if bet.game not in {"roulette", "blackjack", "mines"}:
        raise HTTPException(400, "Unknown game")
    row = supabase.table("users").select("score").eq("email", email).execute()
    points = int((row.data[0] if row.data else {}).get("score") or 0)
    if bet.wager > points:
        raise HTTPException(400, "Not enough points")

    payout = 0
    won = False
    result: dict[str, Any] = {}
    if bet.game == "roulette":
        rolled = random.randint(0, 36)
        red_numbers = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
        won = (bet.bet_type == "number" and bet.choice == rolled) or (bet.bet_type == "red" and rolled in red_numbers) or (bet.bet_type == "black" and rolled != 0 and rolled not in red_numbers)
        payout = bet.wager * (35 if bet.bet_type == "number" else 2) if won else 0
        result["rolled"] = rolled
        result["color"] = "green" if rolled == 0 else "red" if rolled in red_numbers else "black"
    elif bet.game == "mines":
        selected = {tile for tile in bet.selected if 0 <= tile < 25}
        mines = set(bet.mines) if len(bet.mines) == 3 else set(random.sample(range(25), 3))
        won = bool(selected) and not selected.intersection(mines)
        payout = int(bet.wager * (1 + len(selected) * 0.3)) if won else 0
        result["safe"] = won
        result["mines"] = list(mines)
    else:
        player = bet.choice or 0
        dealer_cards = random.sample(["A♠", "K♥", "Q♣", "J♦", "10♠", "9♥", "8♣", "7♦", "6♠", "5♥"], 2)
        dealer = hand_value(dealer_cards)
        won = 0 < player <= 21 and player > dealer
        push = 0 < player <= 21 and player == dealer
        payout = bet.wager * 2 if won else bet.wager if push else 0
        result["message"] = f"You {player} · Dealer {dealer}"
        result["dealer"] = dealer
        result["dealerCards"] = dealer_cards
        result["push"] = push

    new_points = points - bet.wager + payout
    # ponytail: read/update is not atomic; use a database RPC before real-money stakes.
    supabase.table("users").update({"score": new_points}).eq("email", email).execute()
    return {"points": new_points, "payout": payout, "net": payout - bet.wager, "won": won, **result}


@app.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie("access_token", path="/", samesite="lax", secure=False)
    return {"message": "Logged out"}


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


from events import router as events_router
app.include_router(events_router)
