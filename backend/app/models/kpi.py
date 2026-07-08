from pydantic import BaseModel
from typing import Literal
from datetime import datetime

KpiStatus = Literal["ok", "alert", "critical", "pending"]


class KpiSummary(BaseModel):
    cod: str
    sigla: str
    nome: str
    categoria: str
    meta: str
    valor_atual: float | None
    competencia: str | None
    status: KpiStatus
    ultima_atualizacao: datetime | None
    observacao: str | None = None


class KpiDetail(BaseModel):
    cod: str
    sigla: str
    nome: str
    categoria: str
    meta: str
    valor_atual: float | None
    status: KpiStatus
    linhas: list[dict]
    observacao: str | None = None


class KpiHistoricoItem(BaseModel):
    competencia: str
    valor: float | None
    status: KpiStatus
