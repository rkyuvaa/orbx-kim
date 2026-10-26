from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Email or username cannot be empty or whitespace only")
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Password cannot be empty or whitespace only")
        return v


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    initials: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("New password cannot be whitespace only")
        return v


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
