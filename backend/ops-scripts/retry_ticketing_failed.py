"""
Retry dos KPIs TICKETING que falharam com ICEBERG_COMMIT_ERROR no refresh_ticketing_all.py.
Usa um TrinoClient por operacao para evitar conflito de delete files acumulados.

Uso:
    cd backend
    python scripts/retry_ticketing_failed.py
"""
from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

FALHAS = [
    ("12", "2025-11"), ("17", "2025-11"), ("22", "2025-11"), ("27", "2025-11"),
    ("14", "2025-12"), ("17", "2025-12"), ("25", "2025-12"), ("28", "2025-12"),
    ("09", "2026-01"), ("15", "2026-01"), ("17", "2026-01"),
    ("09", "2026-02"), ("13", "2026-02"), ("17", "2026-02"), ("21", "2026-02"),
    ("25", "2026-02"), ("29", "2026-02"),
    ("10", "2026-03"), ("22", "2026-03"), ("28", "2026-03"),
    ("10", "2026-04"), ("13", "2026-04"), ("19", "2026-04"), ("22", "2026-04"),
]


def main() -> None:
    from app.services.kpi_calculator import refresh_kpi
    from app.core.trino_client import TrinoClient

    erros: list[str] = []
    total = len(FALHAS)

    log.info("Retentando %d KPIs com falha de ICEBERG_COMMIT_ERROR", total)

    for i, (cod, mes) in enumerate(FALHAS, 1):
        # TrinoClient novo por operacao — evita delete files acumulados no mesmo client
        for tentativa in (1, 2, 3):
            conn = TrinoClient()
            try:
                refresh_kpi(conn, cod, mes)
                log.info("[%d/%d] KPI %s / %s OK (tentativa %d)", i, total, cod, mes, tentativa)
                break
            except Exception as exc:
                conn.close()
                if tentativa < 3:
                    log.warning(
                        "[%d/%d] KPI %s / %s tentativa %d falhou: %s — aguardando 15s",
                        i, total, cod, mes, tentativa, exc
                    )
                    time.sleep(15)
                else:
                    log.error("[%d/%d] KPI %s / %s falhou apos 3 tentativas: %s", i, total, cod, mes, exc)
                    erros.append(f"{cod}/{mes}")
            else:
                conn.close()
            # pausa entre operacoes para deixar Iceberg estabilizar metadata
            time.sleep(2)

    log.info("=== Concluido: %d/%d OK, %d erros ===", total - len(erros), total, len(erros))
    if erros:
        log.error("Ainda com erro: %s", erros)
        sys.exit(1)


if __name__ == "__main__":
    main()
