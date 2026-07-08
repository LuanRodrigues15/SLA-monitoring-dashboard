"""
Recalcula todos os KPIs TICKETING (09-31) para todos os meses disponíveis,
incluindo os meses fechados (2025-11, 2025-12, 2026-01, 2026-02).

Chamada direta a refresh_kpi - NAO passa pelo APScheduler nem
verifica controle_mes_fechado. Usar somente apos nova ingestao do TICKETING.

Uso:
    cd backend
    python scripts/refresh_ticketing_all.py
"""
from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

# garante que o diretorio backend/ esteja no sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

MESES = [
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
]


def main() -> None:
    from app.core.trino_client import TrinoClient
    from app.services.kpi_calculator import _TICKETING_KPI_CONFIG, refresh_kpi

    cods = sorted(_TICKETING_KPI_CONFIG.keys())
    total = len(MESES) * len(cods)
    done = 0
    erros: list[str] = []

    log.info("Iniciando recalculo de %d KPIs TICKETING x %d meses = %d calculos", len(cods), len(MESES), total)

    for mes in MESES:
        log.info("=== Mes %s (%d KPIs) ===", mes, len(cods))
        conn = TrinoClient()
        try:
            for cod in cods:
                for tentativa in (1, 2):
                    try:
                        refresh_kpi(conn, cod, mes)
                        done += 1
                        log.info("[%d/%d] KPI %s / %s OK", done, total, cod, mes)
                        break
                    except Exception as exc:
                        if tentativa == 1:
                            log.warning("KPI %s / %s falhou tentativa 1: %s — retentando", cod, mes, exc)
                            time.sleep(3)
                        else:
                            log.error("KPI %s / %s falhou apos retry: %s", cod, mes, exc)
                            erros.append(f"{cod}/{mes}")
                            done += 1
        finally:
            conn.close()

    log.info("=== Concluido: %d/%d OK, %d erros ===", total - len(erros), total, len(erros))
    if erros:
        log.error("KPIs com erro: %s", erros)
        sys.exit(1)


if __name__ == "__main__":
    main()
