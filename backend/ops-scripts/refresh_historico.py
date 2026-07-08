"""
Recalcula KPIs 02-31 para os meses históricos 2025-11, 2025-12, 2026-01, 2026-02.
KPI 01 (MNT) não recalcula aqui — valor vem da agregação de stage_mcfo_input.

Uso:
    cd backend
    .\.venv\Scripts\python.exe scripts\refresh_historico.py
"""
from __future__ import annotations

import logging
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

MESES = ["2025-11", "2025-12", "2026-01", "2026-02"]


def main() -> None:
    from app.core.trino_client import TrinoClient
    from app.services.kpi_calculator import KPI_CATALOG, refresh_kpi

    cods = [k["cod"] for k in KPI_CATALOG if k["cod"] != "01"]
    total = len(MESES) * len(cods)
    done = 0
    erros: list[str] = []

    for mes in MESES:
        log.info("=== Iniciando mes %s (%d KPIs) ===", mes, len(cods))
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
