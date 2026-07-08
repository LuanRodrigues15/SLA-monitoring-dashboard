from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.core.security import verify_password, create_access_token, hash_password
from app.core.trino_client import TrinoClient
from app.deps import get_trino, get_current_user
from app.models.auth import LoginRequest, TokenResponse, UserOut, ChangePasswordRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, trino: TrinoClient = Depends(get_trino)) -> TokenResponse:
    schema = f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"
    rows = trino.query_dict(
        f"SELECT id, name, email, password_hash, role, active FROM {schema}.users WHERE email = %s",
        (body.email,),
    )
    if not rows or not rows[0]["active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    row = rows[0]
    if not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    token = create_access_token({"sub": row["email"]})
    user = UserOut(id=row["id"], name=row["name"], email=row["email"], role=row["role"], active=row["active"])
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=UserOut)
def me(user: UserOut = Depends(get_current_user)) -> UserOut:
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    current_user: UserOut = Depends(get_current_user),
    trino: TrinoClient = Depends(get_trino),
):
    schema = f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"
    rows = trino.query_dict(
        f"SELECT password_hash FROM {schema}.users WHERE id = %s",
        (current_user.id,),
    )
    if not rows or not verify_password(body.current_password, rows[0]["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A nova senha deve ter ao menos 6 caracteres")
    trino.execute(
        f"UPDATE {schema}.users SET password_hash=%s WHERE id=%s",
        (hash_password(body.new_password), current_user.id),
    )
