from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
import io
import pytz

from app.core.trino_client import TrinoClient
from app.deps import get_trino, get_current_user, require_role
from app.models.auth import UserOut
from app.models.envio import EnvioSftpRequest, EnvioLogOut
from app.services.zip_builder import build_zip
from app.services.sftp_sender import send_sftp

_FUSO = pytz.timezone("America/Sao_Paulo")

router = APIRouter(prefix="/api/envio", tags=["envio"])

_gestao_plus = require_role("gestao", "admin")


@router.post("/zip")
def gerar_zip(
    competencia: str | None = Query(default=None),
    trino: TrinoClient = Depends(get_trino),
    user: UserOut = Depends(_gestao_plus),
):
    zip_bytes = build_zip(trino, competencia)
    now = datetime.now(_FUSO)
    if competencia:
        year, month = int(competencia[:4]), int(competencia[5:7])
        file_date = now.replace(year=year, month=month, day=1)
    else:
        file_date = now.replace(day=1)
    filename = file_date.strftime("Pacote Indicadores SLA Monitoring Dashboard %d-%m-%Y.zip")
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/sftp")
def enviar_sftp(
    body: EnvioSftpRequest,
    background_tasks: BackgroundTasks,
    trino: TrinoClient = Depends(get_trino),
    user: UserOut = Depends(_gestao_plus),
):
    if body.confirmacao != "enviar":
        raise HTTPException(status_code=400, detail="Confirmação inválida — digite 'enviar'")

    background_tasks.add_task(send_sftp, trino, body.indicadores, body.competencia, user.email)
    return {"message": "Envio SFTP iniciado em background"}


_historico_allowed = require_role("gestao", "admin")

@router.get("/historico", response_model=list[EnvioLogOut])
def historico_envios(
    trino: TrinoClient = Depends(get_trino),
    _user: UserOut = Depends(_historico_allowed),
):
    from app.config import settings
    schema = f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"
    rows = trino.query_dict(
        f"""SELECT id, usuario_email, dt_envio, indicadores_enviados,
                   status, mensagem_erro, qtd_arquivos_ok
            FROM {schema}.tb_log_envio_sftp
            ORDER BY dt_envio DESC
            LIMIT 100"""
    )
    return [EnvioLogOut(**r) for r in rows]
