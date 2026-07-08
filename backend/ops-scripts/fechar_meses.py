from app.config import settings
from app.core.trino_client import TrinoClient

conn = TrinoClient()
schema = f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"

for mes in ["2025-11", "2025-12", "2026-01", "2026-02"]:
    rows = conn.query_dict(
        f"SELECT competencia FROM {schema}.controle_mes_fechado WHERE competencia = '{mes}'"
    )
    if not rows:
        conn.execute(
            f"INSERT INTO {schema}.controle_mes_fechado (competencia, fechado, updated_at)"
            f" VALUES ('{mes}', TRUE, CURRENT_TIMESTAMP)"
        )
        print(f"Fechado: {mes}")
    else:
        print(f"Ja fechado: {mes}")

conn.close()
print("Concluido.")
