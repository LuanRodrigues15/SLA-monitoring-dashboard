from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import decode_token
from app.core.trino_client import TrinoClient
from app.models.auth import UserOut

bearer_scheme = HTTPBearer()


def get_trino() -> Generator[TrinoClient, None, None]:
    client = TrinoClient()
    try:
        yield client
    finally:
        client.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    trino: TrinoClient = Depends(get_trino),
) -> UserOut:
    token = credentials.credentials
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token malformado")

    rows = trino.query_dict(
        "SELECT id, name, email, role, active FROM {schema}.users WHERE email = %s AND active = true".format(
            schema=_schema_ops(trino)
        ),
        (email,),
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")

    row = rows[0]
    return UserOut(id=row["id"], name=row["name"], email=row["email"], role=row["role"], active=row["active"])


def _schema_ops(trino: TrinoClient) -> str:
    from app.config import settings
    return f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"


def require_role(*roles: str):
    def checker(user: UserOut = Depends(get_current_user)) -> UserOut:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")
        return user
    return checker
