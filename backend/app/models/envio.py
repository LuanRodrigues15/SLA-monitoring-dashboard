from pydantic import BaseModel
from datetime import datetime
from typing import Literal


class EnvioZipResponse(BaseModel):
    filename: str
    tamanho_bytes: int


class EnvioSftpRequest(BaseModel):
    indicadores: list[str]
    confirmacao: str
    competencia: str | None = None


class EnvioLogOut(BaseModel):
    id: str
    usuario_email: str
    dt_envio: datetime
    indicadores_enviados: list[str]
    status: Literal["sucesso", "parcial", "falha"]
    mensagem_erro: str | None
    qtd_arquivos_ok: int
