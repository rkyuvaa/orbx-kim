from pydantic import BaseModel, Field


class PushKeys(BaseModel):
    p256dh: str = Field(..., description="P-256 DH public key from browser PushSubscription")
    auth: str = Field(..., description="Authentication secret from browser PushSubscription")


class PushSubscribeIn(BaseModel):
    endpoint: str = Field(..., description="Push subscription URL endpoint")
    keys: PushKeys
    user_agent: str | None = None


class PushUnsubscribeIn(BaseModel):
    endpoint: str


class PushPublicKeyOut(BaseModel):
    public_key: str


class PushStatusOut(BaseModel):
    is_subscribed: bool
    subscription_count: int


class PushTestResponse(BaseModel):
    success: bool
    delivered: int
    message: str
