from fastapi import APIRouter, Depends
from app.core.trino_client import TrinoClient
from app.deps import get_trino

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
def health_check(trino: TrinoClient = Depends(get_trino)) -> dict:
    try:
        trino.query_dict("SELECT 1")
        trino_status = "ok"
    except Exception:
        trino_status = "down"
    return {"status": "ok", "trino": trino_status}
