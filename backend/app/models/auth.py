from pydantic import BaseModel, EmailStr
from typing import Literal


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: Literal["admin", "gestor", "readonly", "auditor"]
    active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["admin", "gestor", "readonly", "auditor"] = "readonly"


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    role: Literal["admin", "gestor", "readonly", "auditor"] | None = None
    active: bool | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
