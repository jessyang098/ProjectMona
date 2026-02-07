"""
Authentication module for Mona backend.
Handles Google OAuth, Discord OAuth, and JWT token management.
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
from pydantic import BaseModel

from database import get_db, User, GuestSession
from analytics import analytics, Analytics
from config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI,
    FRONTEND_URL,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    JWT_EXPIRATION_HOURS,
    GUEST_MESSAGE_LIMIT,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Google OAuth URLs
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# Discord OAuth URLs
DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_USERINFO_URL = "https://discord.com/api/users/@me"


class UserResponse(BaseModel):
    """User data returned to frontend."""
    id: str
    email: str
    name: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    """Request body for profile updates."""
    nickname: Optional[str] = None


class GuestStatusResponse(BaseModel):
    """Guest session status."""
    session_id: str
    message_count: int
    messages_remaining: int
    limit_reached: bool


def create_access_token(user_id: str, email: str) -> str:
    """Create JWT access token."""
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    """Verify JWT token and return payload."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> Optional[User]:
    """Get current user from JWT token in cookie or header."""
    token = request.cookies.get("auth_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        return None

    payload = verify_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.get("/google")
async def google_login():
    """Initiate Google OAuth flow."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{query_string}")


@router.get("/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Handle Google OAuth callback."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured"
        )

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": GOOGLE_REDIRECT_URI,
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for token"
            )

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        # Get user info
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info"
            )

        userinfo = userinfo_response.json()

    google_id = userinfo.get("id")
    email = userinfo.get("email")
    name = userinfo.get("name", email.split("@")[0])
    avatar_url = userinfo.get("picture")

    # Find or create user
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    is_new_user = False
    if user:
        # Update existing user
        user.last_login = datetime.utcnow()
        user.name = name
        user.avatar_url = avatar_url
    else:
        # Create new user
        is_new_user = True
        user = User(
            google_id=google_id,
            email=email,
            name=name,
            avatar_url=avatar_url,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    # Track analytics
    if is_new_user:
        analytics.track(Analytics.EVENT_SIGNUP, user.id, {"provider": "google"})
        analytics.identify(user.id, {"email": user.email, "name": user.name})
    else:
        analytics.track(Analytics.EVENT_LOGIN, user.id, {"provider": "google"})

    # Create JWT token
    token = create_access_token(user.id, user.email)

    # Redirect to frontend with token in cookie
    response = RedirectResponse(url=f"{FRONTEND_URL}?auth=success")
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=True,  # Use True in production with HTTPS
        samesite="lax",
        max_age=JWT_EXPIRATION_HOURS * 3600,
    )
    return response


@router.get("/discord")
async def discord_login():
    """Initiate Discord OAuth flow."""
    if not DISCORD_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Discord OAuth not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET."
        )

    params = {
        "client_id": DISCORD_CLIENT_ID,
        "redirect_uri": DISCORD_REDIRECT_URI,
        "response_type": "code",
        "scope": "identify email",
    }
    query_string = urlencode(params)
    return RedirectResponse(f"{DISCORD_AUTH_URL}?{query_string}")


@router.get("/discord/callback")
async def discord_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Handle Discord OAuth callback."""
    if not DISCORD_CLIENT_ID or not DISCORD_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Discord OAuth not configured"
        )

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            DISCORD_TOKEN_URL,
            data={
                "client_id": DISCORD_CLIENT_ID,
                "client_secret": DISCORD_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": DISCORD_REDIRECT_URI,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_response.status_code != 200:
            print(f"Discord token error: {token_response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for token"
            )

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        # Get user info
        userinfo_response = await client.get(
            DISCORD_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info"
            )

        userinfo = userinfo_response.json()

    discord_id = userinfo.get("id")
    email = userinfo.get("email")
    username = userinfo.get("username")
    global_name = userinfo.get("global_name")  # Discord display name
    name = global_name or username
    avatar_hash = userinfo.get("avatar")

    # Discord avatar URL
    if avatar_hash:
        avatar_url = f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar_hash}.png"
    else:
        # Default Discord avatar
        default_avatar = int(discord_id) % 5
        avatar_url = f"https://cdn.discordapp.com/embed/avatars/{default_avatar}.png"

    # Email is required - Discord may not provide it if user hasn't verified
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required. Please verify your email on Discord and try again."
        )

    # Find user by discord_id or email
    result = await db.execute(
        select(User).where(or_(User.discord_id == discord_id, User.email == email))
    )
    user = result.scalar_one_or_none()

    is_new_user = False
    if user:
        # Update existing user
        user.last_login = datetime.utcnow()
        user.name = name
        user.avatar_url = avatar_url
        if not user.discord_id:
            user.discord_id = discord_id  # Link Discord to existing account
    else:
        # Create new user
        is_new_user = True
        user = User(
            discord_id=discord_id,
            email=email,
            name=name,
            avatar_url=avatar_url,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    # Track analytics
    if is_new_user:
        analytics.track(Analytics.EVENT_SIGNUP, user.id, {"provider": "discord"})
        analytics.identify(user.id, {"email": user.email, "name": user.name})
    else:
        analytics.track(Analytics.EVENT_LOGIN, user.id, {"provider": "discord"})

    # Create JWT token
    token = create_access_token(user.id, user.email)

    # Redirect to frontend with token in cookie
    response = RedirectResponse(url=f"{FRONTEND_URL}?auth=success")
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=JWT_EXPIRATION_HOURS * 3600,
    )
    return response


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
    )


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile (nickname, etc.)."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    # Update nickname if provided
    if profile.nickname is not None:
        # Allow empty string to clear nickname, or set new value
        user.nickname = profile.nickname if profile.nickname else None

    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
    )


@router.post("/logout")
async def logout(response: Response):
    """Logout user by clearing auth cookie."""
    response.delete_cookie("auth_token")
    return {"message": "Logged out successfully"}


@router.get("/guest-status", response_model=GuestStatusResponse)
async def get_guest_status(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get guest session status and message count."""
    result = await db.execute(
        select(GuestSession).where(GuestSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        # Create new guest session
        session = GuestSession(session_id=session_id, message_count=0)
        db.add(session)
        await db.commit()
        await db.refresh(session)

    messages_remaining = max(0, GUEST_MESSAGE_LIMIT - session.message_count)

    return GuestStatusResponse(
        session_id=session.session_id,
        message_count=session.message_count,
        messages_remaining=messages_remaining,
        limit_reached=session.message_count >= GUEST_MESSAGE_LIMIT,
    )


@router.post("/guest-increment")
async def increment_guest_count(session_id: str, db: AsyncSession = Depends(get_db)):
    """Increment guest message count. Returns updated status."""
    result = await db.execute(
        select(GuestSession).where(GuestSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        session = GuestSession(session_id=session_id, message_count=1)
        db.add(session)
    else:
        session.message_count += 1
        session.last_active = datetime.utcnow()

    await db.commit()
    await db.refresh(session)

    messages_remaining = max(0, GUEST_MESSAGE_LIMIT - session.message_count)

    return GuestStatusResponse(
        session_id=session.session_id,
        message_count=session.message_count,
        messages_remaining=messages_remaining,
        limit_reached=session.message_count >= GUEST_MESSAGE_LIMIT,
    )
