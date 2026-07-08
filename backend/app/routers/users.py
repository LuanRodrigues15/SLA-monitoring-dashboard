import uuid
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.core.security import hash_password
from app.core.trino_client import TrinoClient
from app.deps import get_trino, require_role
from app.models.auth import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])

_admin = require_role("admin")
_schema = lambda: f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"


@router.get("", response_model=list[UserOut])
def list_users(trino: TrinoClient = Depends(get_trino), _=Depends(_admin)):
    rows = trino.query_dict(f"SELECT id, name, email, role, active FROM {_schema()}.users ORDER BY name")
    return [UserOut(**r) for r in rows]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, trino: TrinoClient = Depends(get_trino), _=Depends(_admin)):
    existing = trino.query_dict(
        f"SELECT id FROM {_schema()}.users WHERE email = %s", (body.email,)
    )
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    uid = str(uuid.uuid4())
    pw_hash = hash_password(body.password)
    trino.execute(
        f"""INSERT INTO {_schema()}.users (id, name, email, password_hash, role, active, created_at)
            VALUES (%s, %s, %s, %s, %s, true, CURRENT_TIMESTAMP)""",
        (uid, body.name, body.email, pw_hash, body.role),
    )
    return UserOut(id=uid, name=body.name, email=body.email, role=body.role, active=True)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserUpdate,
    trino: TrinoClient = Depends(get_trino),
    _=Depends(_admin),
):
    rows = trino.query_dict(f"SELECT id, name, email, role, active FROM {_schema()}.users WHERE id = %s", (user_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    row = rows[0]
    new_name = body.name or row["name"]
    new_email = body.email or row["email"]
    new_role = body.role or row["role"]
    new_active = body.active if body.active is not None else row["active"]
    new_hash = hash_password(body.password) if body.password else None

    if new_hash:
        trino.execute(
            f"UPDATE {_schema()}.users SET name=%s, email=%s, role=%s, active=%s, password_hash=%s WHERE id=%s",
            (new_name, new_email, new_role, new_active, new_hash, user_id),
        )
    else:
        trino.execute(
            f"UPDATE {_schema()}.users SET name=%s, email=%s, role=%s, active=%s WHERE id=%s",
            (new_name, new_email, new_role, new_active, user_id),
        )

    return UserOut(id=user_id, name=new_name, email=new_email, role=new_role, active=new_active)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(user_id: str, trino: TrinoClient = Depends(get_trino), _=Depends(_admin)):
    trino.execute(f"UPDATE {_schema()}.users SET active=false WHERE id=%s", (user_id,))
