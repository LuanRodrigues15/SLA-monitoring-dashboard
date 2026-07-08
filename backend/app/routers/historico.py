"""Router de histórico de KPIs e pacotes de indicadores.

Endpoints:
  GET  /api/historico/meses    — meses disponíveis (>= 2025-12) com status de fechado
  GET  /api/historico/series   — série histórica de todos os KPIs para gráficos
  GET  /api/historico/download — baixa pacote de um mês (tipo: full | excel | txts)
"""
from __future__ import annotations

import io
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.config import settings
from app.core.trino_client import TrinoClient
from app.deps import get_trino, get_current_user, require_role
from app.models.auth import UserOut
from app.services.kpi_calculator import KPI_CATALOG
from app.services.zip_builder import build_zip, _fmt_dt

router = APIRouter(prefix="/api/historico", tags=["historico"])
log = logging.getLogger(__name__)

_MIN_COMPETENCIA = "2025-12"

# Competência mínima por KPI — meses anteriores usavam lógica diferente e não
# são comparáveis com a implementação atual.
_MIN_COMPETENCIA_INV: dict[str, str] = {
    "02": "2026-03",  # DMA: lógica STATUS EQUIP/SINAL+billing consolidada a partir de mar/2026
    "03": "2026-03",  # EBA: inventário sem snapshot histórico confiável antes de mar/2026
    "06": "2026-03",  # EBC: idem
}


def _schema_ops() -> str:
    return f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"


# ── Meses disponíveis com status de fechado ───────────────────────────────────

class MesStatus:
    def __init__(self, competencia: str, fechado: bool, dt_fechamento: str | None, fechado_por: str | None):
        self.competencia = competencia
        self.fechado = fechado
        self.dt_fechamento = dt_fechamento
        self.fechado_por = fechado_por

    def dict(self):
        return {
            "competencia": self.competencia,
            "fechado": self.fechado,
            "dt_fechamento": self.dt_fechamento,
            "fechado_por": self.fechado_por,
        }


@router.get("/meses")
def list_meses(
    trino: TrinoClient = Depends(get_trino),
    _user: UserOut = Depends(get_current_user),
) -> list[dict]:
    """Retorna meses disponíveis: apenas meses com ingestão oficial (sla_meses_consolidado)
    mais o mês corrente aberto (kpi_agg_test)."""
    schema = _schema_ops()
    hoje = date.today()
    mes_corrente = f"{hoje.year:04d}-{hoje.month:02d}"

    # Meses com dados oficialmente ingeridos via TXT
    consolidado_rows = trino.query_dict(
        f"SELECT DISTINCT competencia FROM {schema}.sla_meses_consolidado"
        f" WHERE tipo = 'VALOR' ORDER BY competencia DESC"
    )
    meses_disponiveis = [r["competencia"] for r in consolidado_rows]

    # Adiciona mês corrente se tiver dados ao vivo
    if mes_corrente not in meses_disponiveis:
        check = trino.query_dict(
            f"SELECT competencia FROM {schema}.kpi_agg_test"
            f" WHERE competencia = '{mes_corrente}' AND kpi_valor IS NOT NULL LIMIT 1"
        )
        if check:
            meses_disponiveis = [mes_corrente] + meses_disponiveis

    # Status de fechamento
    try:
        fechados_rows = trino.query_dict(
            f"SELECT competencia, updated_at FROM {schema}.controle_mes_fechado"
        )
        fechados = {r["competencia"]: r for r in fechados_rows}
    except Exception:
        fechados = {}

    result = []
    for mes in meses_disponiveis:
        info = fechados.get(mes)
        dt_f = _fmt_dt(info["updated_at"]) if info and info.get("updated_at") else None
        result.append({
            "competencia": mes,
            "fechado": mes in fechados,
            "dt_fechamento": dt_f,
            "fechado_por": None,
            "corrente": mes == mes_corrente,
        })

    return result


# ── Série histórica para gráficos ─────────────────────────────────────────────

@router.get("/series")
def get_series(
    trino: TrinoClient = Depends(get_trino),
    _user: UserOut = Depends(get_current_user),
) -> list[dict]:
    """Retorna série temporal de todos os KPIs: meses ingeridos oficialmente
    (sla_meses_consolidado) mais o mês corrente ao vivo (kpi_agg_test)."""
    schema = _schema_ops()
    hoje = date.today()
    mes_corrente = f"{hoje.year:04d}-{hoje.month:02d}"

    # Dados dos meses oficialmente ingeridos
    consolidado_rows = trino.query_dict(
        f"SELECT cod, competencia, kpi_valor FROM {schema}.sla_meses_consolidado"
        f" WHERE tipo = 'VALOR' ORDER BY cod, competencia"
    )
    # Dados do mês corrente ao vivo
    corrente_rows = trino.query_dict(
        f"SELECT cod, competencia, kpi_valor FROM {schema}.kpi_agg_test"
        f" WHERE competencia = '{mes_corrente}'"
    )

    # Agrupa por cod
    by_cod: dict[str, list[dict]] = {}
    for r in consolidado_rows + corrente_rows:
        cod = str(r["cod"])
        if cod not in by_cod:
            by_cod[cod] = []
        by_cod[cod].append({
            "competencia": r["competencia"],
            "valor": float(r["kpi_valor"]) if r.get("kpi_valor") is not None else None,
        })

    result = []
    for kpi in KPI_CATALOG:
        cod = kpi["cod"]
        serie = sorted(by_cod.get(cod, []), key=lambda x: x["competencia"])
        min_comp = _MIN_COMPETENCIA_INV.get(cod)
        if min_comp:
            serie = [s for s in serie if s["competencia"] >= min_comp]
        result.append({
            "cod": cod,
            "sigla": kpi["sigla"],
            "nome": kpi["nome"],
            "serie": serie,
        })

    return result


# ── Controle manual de mês fechado ────────────────────────────────────────────

@router.post("/fechar/{competencia}")
def fechar_mes_manual(
    competencia: str,
    trino: TrinoClient = Depends(get_trino),
    user: UserOut = Depends(require_role("gestor", "admin")),
) -> dict:
    """Fecha um mês manualmente, impedindo recálculo automático pelo APScheduler."""
    schema = _schema_ops()
    rows = trino.query_dict(
        f"SELECT competencia FROM {schema}.controle_mes_fechado WHERE competencia = '{competencia}'"
    )
    if not rows:
        trino.execute(
            f"INSERT INTO {schema}.controle_mes_fechado (competencia, fechado, updated_at)"
            f" VALUES ('{competencia}', TRUE, CURRENT_TIMESTAMP)"
        )
    return {"competencia": competencia, "fechado": True}


@router.delete("/fechar/{competencia}")
def reabrir_mes(
    competencia: str,
    trino: TrinoClient = Depends(get_trino),
    user: UserOut = Depends(require_role("gestor", "admin")),
) -> dict:
    """Reabre um mês fechado, permitindo recálculo automático pelo APScheduler."""
    schema = _schema_ops()
    trino.execute(
        f"DELETE FROM {schema}.controle_mes_fechado WHERE competencia = '{competencia}'"
    )
    return {"competencia": competencia, "fechado": False}


# ── Download de pacote por mês e tipo ─────────────────────────────────────────

@router.get("/download")
def download_pacote(
    competencia: str = Query(..., description="Competência no formato YYYY-MM"),
    tipo: str = Query(default="full", description="Tipo: full | excel | txts"),
    trino: TrinoClient = Depends(get_trino),
    user: UserOut = Depends(require_role("gestor", "admin")),
):
    """Baixa o pacote de indicadores de um mês específico."""
    if tipo not in ("full", "excel", "txts"):
        raise HTTPException(status_code=400, detail="tipo deve ser 'full', 'excel' ou 'txts'")

    try:
        content = build_zip(trino, competencia, content_type=tipo)
    except Exception as exc:
        log.exception("Erro ao gerar pacote %s tipo=%s: %s", competencia, tipo, exc)
        raise HTTPException(status_code=500, detail=f"Erro ao gerar pacote: {exc}")

    year, month = competencia[:4], competencia[5:7]
    comp_label = f"{month}_{year}"

    if tipo == "excel":
        filename = f"Indicadores_SLA Monitoring Dashboard_{comp_label}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        filename = f"Pacote_Indicadores_SLA_{comp_label}.zip"
        media_type = "application/zip"

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
