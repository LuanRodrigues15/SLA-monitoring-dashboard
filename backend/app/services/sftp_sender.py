"""
Sends TXT indicator files to the Auditor SFTP server and logs results.

Reuses build_zip to guarantee the TXT files have the exact same 14-column format
as the ZIP downloaded via the API — avoids any divergence in formatting.
"""
from __future__ import annotations

import io
import logging
import uuid
import zipfile
from datetime import datetime

import paramiko

from app.config import settings
from app.core.trino_client import TrinoClient
from app.services.kpi_calculator import KPI_CATALOG, _has_consolidado
from app.services.zip_builder import build_zip

log = logging.getLogger(__name__)

_BATCH_SIZE = 150


def _schema_ops() -> str:
    return f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"


def _snapshot_consolidado(trino: TrinoClient, zip_bytes: bytes, competencia: str) -> None:
    """Grava snapshot do mês em sla_meses_consolidado (VALOR + DETALHE).

    Captura os valores de kpi_agg_test e os TXTs do ZIP gerado no momento do envio,
    garantindo auditoria exata do que foi enviado ao Auditor. Idempotente: verifica
    _has_consolidado antes de inserir; se já existir, não sobrescreve.
    """
    if _has_consolidado(trino, competencia):
        log.info("snapshot_consolidado: %s já existe — ignorado", competencia)
        return

    schema = _schema_ops()
    hora_snapshot = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    def _esc(s: str) -> str:
        return s.replace("'", "''")

    def _val(s: str) -> str:
        return f"'{_esc(s)}'" if s else "NULL"

    def _flush(batch: list[str]) -> None:
        if not batch:
            return
        vals = ",\n".join(batch)
        trino.execute(
            f"INSERT INTO {schema}.sla_meses_consolidado"
            f" (competencia, cod, tipo, kpi_valor, id_arquivo, categoria, detalhamento,"
            f"  texto_01, texto_02, texto_03, texto_04, texto_05,"
            f"  dt_inicial, dt_final, medicao, hora_arquivo)"
            f" VALUES {vals}"
        )

    # 1. VALOR — de kpi_agg_test
    valor_rows = trino.query_dict(
        f"SELECT cod, kpi_valor FROM {schema}.kpi_agg_test WHERE competencia = '{competencia}'"
    )
    for row in valor_rows:
        cod = str(row["cod"])
        val = row.get("kpi_valor")
        val_expr = str(val) if val is not None else "NULL"
        try:
            trino.execute(
                f"INSERT INTO {schema}.sla_meses_consolidado"
                f" (competencia, cod, tipo, kpi_valor, id_arquivo, categoria, detalhamento,"
                f"  texto_01, texto_02, texto_03, texto_04, texto_05,"
                f"  dt_inicial, dt_final, medicao, hora_arquivo)"
                f" VALUES ('{competencia}', '{cod}', 'VALOR', {val_expr},"
                f"  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{hora_snapshot}')"
            )
        except Exception as exc:
            log.error("snapshot_consolidado VALOR cod=%s: %s", cod, exc)

    # 2. DETALHE — TXTs do ZIP (exatamente o que foi enviado ao Auditor)
    batch: list[str] = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for kpi in KPI_CATALOG:
            fname = f"{kpi['cod']} ({kpi['sigla']}).txt"
            if fname not in zf.namelist():
                continue
            content = zf.read(fname).decode("utf-8")
            for line in content.splitlines():
                line = line.strip()
                if not line:
                    continue
                cols = line.split("|")
                if len(cols) < 13:
                    continue
                id_arq = _val(cols[0])
                cat    = _val(cols[2])
                det    = _val(cols[4])
                t1     = _val(cols[3])
                t2     = _val(cols[5]) if len(cols) > 5 else "NULL"
                t3     = _val(cols[6]) if len(cols) > 6 else "NULL"
                t4     = _val(cols[7]) if len(cols) > 7 else "NULL"
                t5     = _val(cols[8]) if len(cols) > 8 else "NULL"
                dt_ini = _val(cols[9]) if len(cols) > 9 else "NULL"
                dt_fim = _val(cols[10]) if len(cols) > 10 else "NULL"
                med    = _val(cols[11]) if len(cols) > 11 else "NULL"
                hora   = _val(cols[12]) if len(cols) > 12 else f"'{hora_snapshot}'"
                batch.append(
                    f"('{competencia}', '{kpi['cod']}', 'DETALHE', NULL,"
                    f" {id_arq}, {cat}, {det},"
                    f" {t1}, {t2}, {t3}, {t4}, {t5},"
                    f" {dt_ini}, {dt_fim}, {med}, {hora})"
                )
                if len(batch) >= _BATCH_SIZE:
                    try:
                        _flush(batch)
                    except Exception as exc:
                        log.error("snapshot_consolidado DETALHE batch: %s", exc)
                    batch = []

    if batch:
        try:
            _flush(batch)
        except Exception as exc:
            log.error("snapshot_consolidado DETALHE ultimo batch: %s", exc)

    log.info("snapshot_consolidado: %s concluido", competencia)


def _fechar_mes(trino: TrinoClient, competencia: str, usuario_email: str) -> None:
    """Insere competencia em controle_mes_fechado se ainda não estiver lá."""
    schema = _schema_ops()
    rows = trino.query_dict(
        f"SELECT competencia FROM {schema}.controle_mes_fechado WHERE competencia = '{competencia}'"
    )
    if not rows:
        trino.execute(
            f"INSERT INTO {schema}.controle_mes_fechado (competencia, fechado, updated_at)"
            f" VALUES ('{competencia}', TRUE, CURRENT_TIMESTAMP)"
        )


def send_sftp(
    trino: TrinoClient,
    indicadores: list[str],
    competencia: str | None,
    usuario_email: str,
) -> None:
    kpi_map = {k["cod"]: k for k in KPI_CATALOG}
    target_kpis = [kpi_map[c] for c in indicadores if c in kpi_map]

    erros: list[str] = []
    ok_count = 0
    sent_cods: list[str] = []

    # Gera o ZIP completo (mesmo pipeline do download) e extrai os TXTs selecionados
    try:
        zip_bytes = build_zip(trino, competencia)
    except Exception as exc:
        erros.append(f"Geração ZIP: {exc}")
        _log_result(trino, usuario_email, sent_cods, erros, ok_count, competencia)
        return

    txt_files: dict[str, tuple[str, bytes]] = {}
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for kpi in target_kpis:
            fname = f"{kpi['cod']} ({kpi['sigla']}).txt"
            if fname in zf.namelist():
                txt_files[kpi["cod"]] = (fname, zf.read(fname))

    # Envia via SFTP
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(
            hostname=settings.SFTP_HOST,
            port=settings.SFTP_PORT,
            username=settings.SFTP_USER,
            password=settings.SFTP_PASS,
            timeout=30,
        )
        sftp = ssh.open_sftp()

        for kpi in target_kpis:
            cod = kpi["cod"]
            if cod not in txt_files:
                erros.append(f"{kpi['sigla']}: arquivo não encontrado no ZIP")
                continue
            fname, content = txt_files[cod]
            try:
                remote_path = f"{settings.SFTP_REMOTE_PATH}/{fname}"
                sftp.putfo(io.BytesIO(content), remote_path)
                ok_count += 1
                sent_cods.append(cod)
            except Exception as exc:
                erros.append(f"{kpi['sigla']}: {exc}")

        sftp.close()
    except Exception as conn_exc:
        erros.append(f"Conexão SFTP: {conn_exc}")
    finally:
        ssh.close()

    # Snapshot imutavel do mes — captura o que foi enviado ao Auditor antes de fechar
    if ok_count > 0 and competencia:
        try:
            _snapshot_consolidado(trino, zip_bytes, competencia)
        except Exception as exc:
            log.warning("snapshot_consolidado falhou (nao critico): %s", exc)

    _log_result(trino, usuario_email, sent_cods, erros, ok_count, competencia)


def _log_result(
    trino: TrinoClient,
    usuario_email: str,
    sent_cods: list[str],
    erros: list[str],
    ok_count: int,
    competencia: str | None,
) -> None:
    status_val = "falha" if (erros and ok_count == 0) else ("parcial" if erros else "sucesso")
    if status_val in ("sucesso", "parcial") and competencia:
        try:
            _fechar_mes(trino, competencia, usuario_email)
        except Exception:
            pass
    mensagem_erro = "; ".join(erros) if erros else None
    log_id = str(uuid.uuid4())
    arr_expr = (
        f"ARRAY[{','.join(repr(c) for c in sent_cods)}]"
        if sent_cods
        else "CAST(ARRAY[] AS ARRAY(VARCHAR))"
    )
    trino.execute(
        f"""INSERT INTO {_schema_ops()}.tb_log_envio_sftp
            (id, usuario_email, dt_envio, indicadores_enviados, status, mensagem_erro, qtd_arquivos_ok)
            VALUES (%s, %s, CURRENT_TIMESTAMP, {arr_expr}, %s, %s, %s)""",
        (log_id, usuario_email, status_val, mensagem_erro, ok_count),
    )
