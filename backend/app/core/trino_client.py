from datetime import date, datetime
from decimal import Decimal
from typing import Any
import trino
import pandas as pd

from app.config import settings


def _escape(value: Any) -> str:
    """Converte um valor Python para literal SQL seguro para o Trino."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (date, datetime)):
        return f"TIMESTAMP '{value}'" if isinstance(value, datetime) else f"DATE '{value}'"
    # str e tudo mais: escapa aspas simples
    return "'" + str(value).replace("'", "''") + "'"


def _normalize_row(row: tuple) -> tuple:
    """Converte Decimal → float para garantir serialização JSON correta."""
    return tuple(float(v) if isinstance(v, Decimal) else v for v in row)


def _bind(sql: str, params: tuple | None) -> str:
    """Substitui marcadores %s pelo valor escapado correspondente."""
    if params is None:
        return sql
    parts = sql.split("%s")
    if len(parts) != len(params) + 1:
        raise ValueError(f"SQL tem {len(parts)-1} marcadores mas {len(params)} parâmetros foram passados")
    result = parts[0]
    for val, part in zip(params, parts[1:]):
        result += _escape(val) + part
    return result


class TrinoClient:
    def __init__(self) -> None:
        self._conn = trino.dbapi.connect(
            host=settings.TRINO_HOST,
            port=settings.TRINO_PORT,
            user=settings.TRINO_USER,
            catalog=settings.TRINO_CATALOG,
            schema=settings.TRINO_SCHEMA_OPS,
            request_timeout=120,
        )

    def execute(self, sql: str, params: tuple | None = None) -> None:
        cur = self._conn.cursor()
        cur.execute(_bind(sql, params))

    def query_dict(self, sql: str, params: tuple | None = None) -> list[dict[str, Any]]:
        cur = self._conn.cursor()
        cur.execute(_bind(sql, params))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, _normalize_row(row))) for row in cur.fetchall()]

    def query_df(self, sql: str, params: tuple | None = None) -> pd.DataFrame:
        cur = self._conn.cursor()
        cur.execute(_bind(sql, params))
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
        return pd.DataFrame(rows, columns=cols)

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass
