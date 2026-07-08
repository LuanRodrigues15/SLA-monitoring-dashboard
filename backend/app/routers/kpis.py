from fastapi import APIRouter, Depends, Query

from app.config import settings
from app.core.trino_client import TrinoClient
from app.deps import get_trino, get_current_user
from app.models.kpi import KpiSummary
from app.models.auth import UserOut
from app.services.kpi_calculator import get_all_kpi_summaries

router = APIRouter(prefix="/api/kpis", tags=["kpis"])


@router.get("/competencias", response_model=list[str])
def list_competencias(
    trino: TrinoClient = Depends(get_trino),
    _user: UserOut = Depends(get_current_user),
):
    schema = f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"
    rows = trino.query_dict(
        f"SELECT DISTINCT competencia FROM {schema}.kpi_agg_test"
        f" WHERE kpi_valor IS NOT NULL ORDER BY competencia DESC"
    )
    return [r["competencia"] for r in rows]


@router.get("", response_model=list[KpiSummary])
def list_kpis(
    competencia: str | None = Query(default=None, description="Filtrar por mês YYYY-MM"),
    tabela: str = Query(default="kpi_agg_test", description="Tabela de leitura: kpi_agg_test (prod) ou kpi_agg_test_test"),
    trino: TrinoClient = Depends(get_trino),
    _user: UserOut = Depends(get_current_user),
):
    return get_all_kpi_summaries(trino, competencia=competencia, tabela=tabela)
