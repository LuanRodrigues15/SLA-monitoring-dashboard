"""Job de recálculo automático dos 31 KPIs.

Disparado pelo APScheduler nos horários configurados (07h e 13h, America/Sao_Paulo).
Recalcula a competência corrente e a anterior — cobre fechamento atrasado do mês passado.
Meses presentes em controle_mes_fechado são ignorados (já foram enviados ao Auditor).
"""
from __future__ import annotations

import logging
from datetime import date

from app.config import settings
from app.core.trino_client import TrinoClient
from app.services.kpi_calculator import refresh_all_kpis

log = logging.getLogger(__name__)


def _competencias_alvo(hoje: date | None = None) -> list[str]:
    hoje = hoje or date.today()
    corrente = f"{hoje.year:04d}-{hoje.month:02d}"
    if hoje.month == 1:
        anterior = f"{hoje.year - 1:04d}-12"
    else:
        anterior = f"{hoje.year:04d}-{hoje.month - 1:02d}"
    return [corrente, anterior]


def _meses_fechados(conn: TrinoClient) -> set[str]:
    schema = f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"
    try:
        rows = conn.query_dict(f"SELECT competencia FROM {schema}.controle_mes_fechado")
        return {r["competencia"] for r in rows}
    except Exception:
        return set()


def run() -> None:
    """Recalcula mês corrente e mês anterior, saltando meses já enviados ao Auditor."""
    competencias = _competencias_alvo()
    log.info("[scheduler] iniciando refresh_kpis para competencias=%s", competencias)
    for mes in competencias:
        conn = TrinoClient()
        try:
            fechados = _meses_fechados(conn)
            if mes in fechados:
                log.info("[scheduler] %s já está em controle_mes_fechado — ignorado", mes)
                continue
            refresh_all_kpis(conn, mes)
            log.info("[scheduler] refresh_all_kpis(%s) concluído", mes)
        except Exception as exc:
            log.exception("[scheduler] refresh_all_kpis(%s) falhou: %s", mes, exc)
        finally:
            conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    run()
