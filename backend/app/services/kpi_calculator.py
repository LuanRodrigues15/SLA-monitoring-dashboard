"""
KPI calculator — todos os 31 indicadores SLA Monitoring Dashboard.

Lógica completamente inline: sem arquivos SQL externos.
Cada família de KPI tem um dict de configuração e uma função geradora de SQL.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

log = logging.getLogger(__name__)

from app.config import settings
from app.core.trino_client import TrinoClient
from app.models.kpi import KpiDetail, KpiHistoricoItem, KpiSummary

# ---------------------------------------------------------------------------
# Catálogo dos 31 KPIs (metadados para frontend e avaliação de status)
# ---------------------------------------------------------------------------

# Segmentos de serviço (ilustrativos): A=Enlace de Dados, B=Telefonia IP,
# C=Conectividade Sem Fio, D=Monitoramento por Vídeo, E=Serviço Complementar
KPI_CATALOG: list[dict[str, Any]] = [
    {"cod": "01", "sigla": "MNT",  "nome": "Manutenção Corretiva de Enlace",                "categoria": "Disponibilidade Enlace",     "meta": "≤5 NC/M",    "meta_val": 5.0,          "meta_op": "lte", "meta_val_alert":  4.0},
    {"cod": "02", "sigla": "DMA", "nome": "Disponibilidade Mensal — Enlace de Dados",      "categoria": "Disponibilidade Enlace",     "meta": "≥98%",       "meta_val": 98.0,         "meta_op": "gte", "meta_val_alert": 99.0},
    {"cod": "03", "sigla": "EBA",  "nome": "Entrega de Banda — Enlace de Dados",            "categoria": "Disponibilidade Enlace",     "meta": "50 Mbps",    "meta_val": 50.0,         "meta_op": "gte", "meta_val_alert": None},
    {"cod": "04", "sigla": "DMB",  "nome": "Disponibilidade Mensal — Telefonia IP",         "categoria": "Disponibilidade",            "meta": "≥98%",       "meta_val": 98.0,         "meta_op": "gte", "meta_val_alert": 99.0},
    {"cod": "05", "sigla": "DMC",  "nome": "Disponibilidade Mensal — Conectividade Sem Fio","categoria": "Disponibilidade",            "meta": "≥98%",       "meta_val": 98.0,         "meta_op": "gte", "meta_val_alert": 99.0},
    {"cod": "06", "sigla": "EBC",  "nome": "Entrega de Banda — Conectividade Sem Fio",       "categoria": "Disponibilidade",            "meta": "100 Mbps",   "meta_val": 100.0,        "meta_op": "gte", "meta_val_alert": None},
    {"cod": "07", "sigla": "DMD",  "nome": "Disponibilidade Mensal — Monitoramento por Vídeo","categoria": "Disponibilidade",           "meta": "≥98%",       "meta_val": 98.0,         "meta_op": "gte", "meta_val_alert": 99.0},
    {"cod": "08", "sigla": "DME",  "nome": "Disponibilidade Mensal — Serviço Complementar", "categoria": "Disponibilidade",            "meta": "≥98%",       "meta_val": 98.0,         "meta_op": "gte", "meta_val_alert": 99.0},
    {"cod": "09", "sigla": "SO1",  "nome": "Qualidade do Serviço de Operação",              "categoria": "Satisfação",                 "meta": "≥85%",       "meta_val": 85.0,         "meta_op": "gte", "meta_val_alert": 92.0},
    {"cod": "10", "sigla": "SO2",  "nome": "Qualidade de Satisfação no Atendimento",         "categoria": "Satisfação",                 "meta": "≥85%",       "meta_val": 85.0,         "meta_op": "gte", "meta_val_alert": 92.0},
    {"cod": "11", "sigla": "SO3",  "nome": "Grau de Satisfação — Telefonia IP",             "categoria": "Satisfação",                 "meta": "≥85%",       "meta_val": 85.0,         "meta_op": "gte", "meta_val_alert": 92.0},
    {"cod": "12", "sigla": "TRA",  "nome": "Tempo de Resposta — Enlace de Dados",           "categoria": "Tempo Resposta",             "meta": "≤3h",        "meta_val": 3.0,          "meta_op": "lte", "meta_val_alert":  2.0},
    {"cod": "13", "sigla": "TSA",  "nome": "Tempo de Solução — Enlace de Dados",            "categoria": "Tempo Solução",              "meta": "≤48h",       "meta_val": 48.0,         "meta_op": "lte", "meta_val_alert": 36.0},
    {"cod": "14", "sigla": "EFA",  "nome": "Efetividade — Enlace de Dados",                 "categoria": "Efetividade",                "meta": "≥85%",       "meta_val": 85.0,         "meta_op": "gte", "meta_val_alert": 92.0},
    {"cod": "15", "sigla": "RBA",  "nome": "Reabertura — Enlace de Dados",                  "categoria": "Reabertura",                 "meta": "≤15%",       "meta_val": 15.0,         "meta_op": "lte", "meta_val_alert": 10.0},
    {"cod": "16", "sigla": "TRB",  "nome": "Tempo de Resposta — Telefonia IP",              "categoria": "Tempo Resposta",             "meta": "≤3h",        "meta_val": 3.0,          "meta_op": "lte", "meta_val_alert":  2.0},
    {"cod": "17", "sigla": "TSB",  "nome": "Tempo de Solução — Telefonia IP",               "categoria": "Tempo Solução",              "meta": "≤48h",       "meta_val": 48.0,         "meta_op": "lte", "meta_val_alert": 36.0},
    {"cod": "18", "sigla": "EFB",  "nome": "Efetividade — Telefonia IP",                    "categoria": "Efetividade",                "meta": "≥85%",       "meta_val": 85.0,         "meta_op": "gte", "meta_val_alert": 92.0},
    {"cod": "19", "sigla": "RBB",  "nome": "Reabertura — Telefonia IP",                     "categoria": "Reabertura",                 "meta": "≤15%",       "meta_val": 15.0,         "meta_op": "lte", "meta_val_alert": 10.0},
    {"cod": "20", "sigla": "TRC",  "nome": "Tempo de Resposta — Conectividade Sem Fio",      "categoria": "Tempo Resposta",             "meta": "≤3h",        "meta_val": 3.0,          "meta_op": "lte", "meta_val_alert":  2.0},
    {"cod": "21", "sigla": "TSC",  "nome": "Tempo de Solução — Conectividade Sem Fio",       "categoria": "Tempo Solução",              "meta": "≤48h",       "meta_val": 48.0,         "meta_op": "lte", "meta_val_alert": 36.0},
    {"cod": "22", "sigla": "EFC",  "nome": "Efetividade — Conectividade Sem Fio",            "categoria": "Efetividade",                "meta": "≥85%",       "meta_val": 85.0,         "meta_op": "gte", "meta_val_alert": 92.0},
    {"cod": "23", "sigla": "RBC",  "nome": "Reabertura — Conectividade Sem Fio",             "categoria": "Reabertura",                 "meta": "≤15%",       "meta_val": 15.0,         "meta_op": "lte", "meta_val_alert": 10.0},
    {"cod": "24", "sigla": "TRD",  "nome": "Tempo de Resposta — Monitoramento por Vídeo",    "categoria": "Tempo Resposta",             "meta": "≤3h",        "meta_val": 3.0,          "meta_op": "lte", "meta_val_alert":  2.0},
    {"cod": "25", "sigla": "TSD",  "nome": "Tempo de Solução — Monitoramento por Vídeo",     "categoria": "Tempo Solução",              "meta": "≤48h",       "meta_val": 48.0,         "meta_op": "lte", "meta_val_alert": 36.0},
    {"cod": "26", "sigla": "EFD",  "nome": "Efetividade — Monitoramento por Vídeo",          "categoria": "Efetividade",                "meta": "≥85%",       "meta_val": 85.0,         "meta_op": "gte", "meta_val_alert": 92.0},
    {"cod": "27", "sigla": "RBD",  "nome": "Reabertura — Monitoramento por Vídeo",           "categoria": "Reabertura",                 "meta": "≤15%",       "meta_val": 15.0,         "meta_op": "lte", "meta_val_alert": 10.0},
    {"cod": "28", "sigla": "TRE",  "nome": "Tempo de Resposta — Serviço Complementar",       "categoria": "Tempo Resposta",             "meta": "≤3h",        "meta_val": 3.0,          "meta_op": "lte", "meta_val_alert":  2.0},
    {"cod": "29", "sigla": "TSE",  "nome": "Tempo de Solução — Serviço Complementar",        "categoria": "Tempo Solução",              "meta": "≤48h",       "meta_val": 48.0,         "meta_op": "lte", "meta_val_alert": 36.0},
    {"cod": "30", "sigla": "EFE",  "nome": "Efetividade — Serviço Complementar",             "categoria": "Efetividade",                "meta": "≥85%",       "meta_val": 85.0,         "meta_op": "gte", "meta_val_alert": 92.0},
    {"cod": "31", "sigla": "RBE",  "nome": "Reabertura — Serviço Complementar",              "categoria": "Reabertura",                 "meta": "≤15%",       "meta_val": 15.0,         "meta_op": "lte", "meta_val_alert": 10.0},
]

_COD_INDEX: dict[str, dict] = {k["cod"]: k for k in KPI_CATALOG}


# ---------------------------------------------------------------------------
# Helpers de schema
# ---------------------------------------------------------------------------

def _ops() -> str:
    return f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"

def _sz() -> str:
    return f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_ZABBIX}"

def _gz() -> str:
    return f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_GOLD_ZABBIX}"

def _ticketing() -> str:
    return f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_TICKETING}.{settings.TICKETING_TABLE}"

def _billing() -> str:
    return f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_BILLING}"

def _eval_status(valor: float | None, meta_val: float, meta_op: str, meta_val_alert: float | None = None) -> str:
    if valor is None:
        return "pending"
    if meta_op == "gte":
        if valor >= meta_val:
            # dentro da meta: ok ou alerta de aproximação do limite inferior
            if meta_val_alert is None or valor >= meta_val_alert:
                return "ok"
            return "alert"
        return "critical"
    else:  # lte
        if valor <= meta_val:
            # dentro da meta: ok ou alerta de aproximação do limite superior
            if meta_val_alert is None or valor <= meta_val_alert:
                return "ok"
            return "alert"
        return "critical"


# ---------------------------------------------------------------------------
# Cache em memória (TTL = 1h) — evita 31 queries ao Trino por página
# ---------------------------------------------------------------------------

import time as _time

_KPI_CACHE: dict[str, tuple[list, float]] = {}
_CACHE_TTL_SEC = 3600


def _cache_get(key: str) -> list | None:
    entry = _KPI_CACHE.get(key)
    if entry and (_time.monotonic() - entry[1]) < _CACHE_TTL_SEC:
        return entry[0]
    return None


def _cache_set(key: str, data: list) -> None:
    _KPI_CACHE[key] = (data, _time.monotonic())


def cache_invalidate() -> None:
    """Chamado após refresh de KPIs para forçar recálculo na próxima requisição."""
    _KPI_CACHE.clear()


# ---------------------------------------------------------------------------
# Leitura da kpi_agg_test
# ---------------------------------------------------------------------------

_TABELAS_PERMITIDAS = {"kpi_agg_test"}


def _resolve_tabela(tabela: str) -> str:
    return "kpi_agg_test"


def _read_kpi_row(trino: TrinoClient, cod: str, competencia: str | None = None, tabela: str = "kpi_agg_test") -> dict:
    schema = _ops()
    t = _resolve_tabela(tabela)

    def _query(tbl: str) -> list[dict]:
        if competencia:
            return trino.query_dict(
                f"SELECT kpi_valor, competencia, updated_at FROM {schema}.{tbl}"
                f" WHERE cod = %s AND competencia = %s ORDER BY updated_at DESC LIMIT 1",
                (cod, competencia),
            )
        return trino.query_dict(
            f"SELECT kpi_valor, competencia, updated_at FROM {schema}.{tbl}"
            f" WHERE cod = %s"
            f" AND competencia = (SELECT MAX(competencia) FROM {schema}.{tbl} WHERE cod = %s)"
            f" ORDER BY updated_at DESC LIMIT 1",
            (cod, cod),
        )

    rows = _query(t)
    return rows[0] if rows else {}


def get_all_kpi_summaries(trino: TrinoClient, competencia: str | None = None, tabela: str = "kpi_agg_test") -> list[KpiSummary]:
    """Retorna os 31 KPIs em UMA única query (antes eram 31 queries sequenciais)."""
    t = _resolve_tabela(tabela)
    # Competências específicas são usadas após recálculos e correções pontuais; ler direto
    # evita mostrar valor antigo na grade enquanto o detalhamento já lê a linha atual.
    use_cache = t == "kpi_agg_test" and competencia is None
    cache_key = f"{t}:__default__"
    if use_cache:
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

    schema = _ops()
    # Leitura exclusiva de kpi_agg_test
    if competencia:
        sql = (
            f"WITH ranked AS ("
            f"  SELECT cod, kpi_valor, competencia, updated_at,"
            f"         ROW_NUMBER() OVER (PARTITION BY cod ORDER BY updated_at DESC) AS rn"
            f"  FROM {schema}.{t} WHERE competencia = '{competencia}'"
            f") SELECT cod, kpi_valor, competencia, updated_at FROM ranked WHERE rn = 1"
        )
    else:
        sql = (
            f"WITH ranked AS ("
            f"  SELECT cod, kpi_valor, competencia, updated_at,"
            f"         ROW_NUMBER() OVER (PARTITION BY cod ORDER BY competencia DESC, updated_at DESC) AS rn"
            f"  FROM {schema}.{t}"
            f") SELECT cod, kpi_valor, competencia, updated_at FROM ranked WHERE rn = 1"
        )

    rows_map: dict[str, dict] = {r["cod"]: r for r in trino.query_dict(sql)}

    result: list[KpiSummary] = []
    for kpi in KPI_CATALOG:
        row = rows_map.get(kpi["cod"], {})
        valor = float(row["kpi_valor"]) if row.get("kpi_valor") is not None else None
        comp = str(row["competencia"]) if row.get("competencia") else None
        raw = row.get("updated_at")
        updated_at: datetime | None = raw if isinstance(raw, datetime) else (_parse_dt(raw) if raw else None)
        result.append(KpiSummary(
            cod=kpi["cod"], sigla=kpi["sigla"], nome=kpi["nome"],
            categoria=kpi["categoria"], meta=kpi["meta"],
            valor_atual=valor, competencia=comp,
            status=_eval_status(valor, kpi["meta_val"], kpi["meta_op"], kpi.get("meta_val_alert")),
            ultima_atualizacao=updated_at,
        ))

    # Para KPIs EA com valor NULL: verificar no TICKETING se há TF > 0 (TA=0, TF>0 — incalculável)
    ea_null = [(s, _EA_COD_TO_SVC[s.cod]) for s in result if s.cod in _EA_COD_TO_SVC and s.valor_atual is None and s.competencia is not None]
    if ea_null:
        h = _ticketing()
        by_comp: dict[str, list] = {}
        for s, svc in ea_null:
            by_comp.setdefault(s.competencia, []).append((s, svc))
        for comp, kpi_svcs in by_comp.items():
            svcs_in = ", ".join(f"'{svc}'" for _, svc in kpi_svcs)
            tf_rows = trino.query_dict(
                f"SELECT servico, COUNT(DISTINCT ticket_id) AS tf"
                f" FROM {h}"
                f" WHERE COALESCE(dt_resolvido_real, dt_resolvido) IS NOT NULL AND COALESCE(dt_resolvido_real, dt_resolvido) != ''"
                f" AND SUBSTR(dt_abertura, 1, 7) = '{comp}'"
                f" AND servico IN ({svcs_in})"
                f" GROUP BY servico"
            )
            tf_map = {r["servico"]: int(r["tf"]) for r in tf_rows}
            for kpi_sum, svc in kpi_svcs:
                if tf_map.get(svc, 0) > 0:
                    kpi_sum.observacao = "TF sem TA no período — incalculável"

    if use_cache:
        _cache_set(cache_key, result)
    return result


def _parse_dt(val: object) -> datetime | None:
    try:
        return datetime.fromisoformat(str(val))
    except Exception:
        return None


def get_kpi_detail(trino: TrinoClient, cod: str, competencia: str | None = None, tabela: str = "kpi_agg_test") -> KpiDetail:
    kpi = _COD_INDEX.get(cod)
    if not kpi:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Indicador {cod} não encontrado")

    row = _read_kpi_row(trino, cod, competencia, tabela)
    valor = float(row["kpi_valor"]) if row.get("kpi_valor") is not None else None
    comp = str(row["competencia"]) if row.get("competencia") else competencia

    linhas = _fetch_detail_lines(trino, cod, comp)

    observacao: str | None = None
    if cod in _EA_COD_TO_SVC and valor is None and comp:
        ta = sum(1 for row in linhas if str(row.get("DT_Abertura") or "")[:7] == comp)
        tf = sum(1 for row in linhas if str(row.get("DT_Resolvido") or "")[:7] == comp)
        if ta == 0 and tf > 0:
            observacao = (
                f"Nenhum chamado foi aberto neste período (TA = 0), portanto o percentual de efetividade "
                f"não pode ser calculado. {tf} chamado(s) resolvido(s) no período são provenientes de "
                f"competências anteriores (TF = {tf})."
            )

    return KpiDetail(
        cod=cod, sigla=kpi["sigla"], nome=kpi["nome"],
        categoria=kpi["categoria"], meta=kpi["meta"],
        valor_atual=valor,
        status=_eval_status(valor, kpi["meta_val"], kpi["meta_op"], kpi.get("meta_val_alert")),
        linhas=linhas,
        observacao=observacao,
    )


def _has_consolidado(trino: TrinoClient, mes: str) -> bool:
    """Retorna True se sla_meses_consolidado já tem dados para o mês (mês fechado/histórico)."""
    schema = _ops()
    try:
        rows = trino.query_dict(
            f"SELECT COUNT(*) AS n FROM {schema}.sla_meses_consolidado"
            f" WHERE competencia = '{mes}' AND tipo = 'DETALHE' LIMIT 1"
        )
        return bool(rows and int(rows[0].get("n", 0)) > 0)
    except Exception:
        return False


def _fetch_detail_consolidado(trino: TrinoClient, cod: str, mes: str) -> list[dict]:
    """Lê linhas de detalhe de sla_meses_consolidado e as mapeia para o formato do frontend."""
    schema = _ops()
    try:
        rows = trino.query_dict(
            f"SELECT id_arquivo, detalhamento, texto_01, texto_02, texto_03,"
            f" texto_04, texto_05, dt_inicial, dt_final, medicao, hora_arquivo"
            f" FROM {schema}.sla_meses_consolidado"
            f" WHERE competencia = '{mes}' AND cod = '{cod}' AND tipo = 'DETALHE'"
            f" ORDER BY dt_inicial"
        )
    except Exception as exc:
        log.error("_fetch_detail_consolidado(%s, %s): %s", cod, mes, exc)
        return []

    tipo = KPI_TIPO_MAP.get(cod, "unknown")
    result = []
    for r in rows:
        det = str(r.get("detalhamento") or "")
        t01 = str(r.get("texto_01") or "")
        t02 = str(r.get("texto_02") or "")
        t05 = str(r.get("texto_05") or "")
        dt1 = str(r.get("dt_inicial") or "")
        dt2 = str(r.get("dt_final") or "")
        med = str(r.get("medicao") or "")

        if tipo == "mcfo":
            trecho = det.split(" ↔ ")
            result.append({
                "trecho_origem": trecho[0] if len(trecho) > 0 else det,
                "trecho_destino": trecho[1] if len(trecho) > 1 else "",
                "nc": int(t01) if t01.lstrip("-").isdigit() else 0,
                "extensao_km": float(t02.replace(",", ".")) if t02 else None,
                "dt_inicio": dt1, "dt_final": dt2,
                "competencia_referencia": mes,
            })
        elif tipo in ("zabbix", "zabbix_billing"):
            v = float(med.replace(",", ".")) if med else None
            result.append({
                "Host": det, "Evento": t01,
                "Inicio_Real": dt1, "Fim_Real": dt2,
                "Horas_Indisp_Real": v,
                "Inicio_VI": dt1, "Fim_VI": dt2,
                "Horas_Indisp_Auditor": v,
            })
        elif tipo == "inv":
            mbps = 100.0 if "100" in med else 50.0
            result.append({"host": det, "mbps_comprometido": mbps})
        elif tipo == "sat":
            result.append({
                "Ticket_ID": det, "Cliente": t01, "Ref_Externa": t05,
                "DT_Abertura": dt1, "DT_Resolvido": dt2,
                "Status": "Positivo" if med in SAT_POSITIVO else "Negativo",
                "Avaliacao": med, "Duracao_em_Dias": None,
            })
        elif tipo == "tr":
            v = float(med.replace(",", ".")) if med else None
            result.append({
                "Ticket_ID": det, "Cliente": t01, "Ref_Externa": t05,
                "DT_Abertura": dt1, "DT_Triagem": dt2,
                "Medicao": v, "Duracao_em_Dias": None,
            })
        elif tipo == "ts":
            v = float(med.replace(",", ".")) if med else None
            result.append({
                "Ticket_ID": det, "Cliente": t01,
                "Horas_Pendente_Cliente": t02, "Ref_Externa": t05,
                "DT_Abertura": dt1, "DT_Resolvido": dt2,
                "Medicao": v, "Duracao_em_Dias": None,
            })
        elif tipo == "ea":
            result.append({
                "Ticket_ID": det, "Cliente": t01, "Ref_Externa": t05,
                "DT_Abertura": dt1, "DT_Resolvido": dt2,
                "Status": "Finalizado" if dt2 else "Pendente",
                "Duracao_em_Dias": None,
            })
        elif tipo == "rt":
            result.append({
                "Ticket_ID": det, "Cliente": t01, "Ref_Externa": t05,
                "DT_Abertura": dt1, "DT_Resolvido": dt2,
                "Reaberto": t01, "Duracao_em_Dias": None,
            })
        else:
            result.append({"Detalhamento": det, "Medicao": med})
    return result


# Mapeamento de cod → tipo (reutiliza a lógica do validation_config)
KPI_TIPO_MAP: dict[str, str] = {
    "01": "mcfo", "02": "zabbix_billing", "03": "inv",
    "04": "zabbix", "05": "zabbix", "06": "inv",
    "07": "zabbix", "08": "zabbix",
    "09": "sat", "10": "sat", "11": "sat",
    "12": "tr", "13": "ts", "14": "ea", "15": "rt",
    "16": "tr", "17": "ts", "18": "ea", "19": "rt",
    "20": "tr", "21": "ts", "22": "ea", "23": "rt",
    "24": "segd", "25": "segd", "26": "segd", "27": "segd",
    "28": "tr", "29": "ts", "30": "ea", "31": "rt",
}

SAT_POSITIVO = {"Excelente", "Bom"}


def _fetch_detail_lines(trino: TrinoClient, cod: str, competencia: str | None) -> list[dict]:
    """Busca as linhas individuais que compõem o KPI na fonte de dados original.

    Para meses com dados em sla_meses_consolidado (fechados/históricos), lê dessa
    tabela. Para o mês corrente aberto, consulta as fontes ao vivo (TICKETING/Zabbix).
    """
    mes = competencia or ""

    # Meses fechados/históricos: lê snapshot imutável
    if mes and _has_consolidado(trino, mes):
        return _fetch_detail_consolidado(trino, cod, mes)

    # --- MCFO ---
    if cod == "01":
        mes_f = f"AND competencia_referencia = '{mes}'" if mes else ""
        try:
            return trino.query_dict(
                f"SELECT trecho_origem, trecho_destino, dt_inicio, dt_final,"
                f" nc, extensao_km, m, ROUND(mcfo_valor,3) AS mcfo_valor,"
                f" pontuacao, competencia_referencia, usuario_email"
                f" FROM {_ops()}.stage_mcfo_input"
                f" WHERE deletado = false {mes_f}"
                f" ORDER BY dt_final DESC"
            )
        except Exception:
            return []

    # --- DMA (KPI 02) — usa a mesma lógica de _dma_cte_block com merge de intervalos ---
    if cod == "02":
        if not mes:
            return []
        try:
            return trino.query_dict(dma_intervals_sql(mes))
        except Exception as exc:
            log.error("_fetch_detail_lines(02) — erro Trino: %s", exc)
            return []

    # --- Zabbix disponibilidade (KPI 02 usa dma_intervals_sql; 04/05/07/08 aqui) ---
    if cod in _ZABBIX_DISP_CONFIG:
        cfg = _ZABBIX_DISP_CONFIG[cod]
        sz, gz = _sz(), _gz()
        groups = ", ".join(str(g) for g in cfg["groupids"])

        if mes:
            mes_cte = (
                f"SELECT DATE_TRUNC('month', DATE_PARSE('{mes}', '%Y-%m')) AS inicio,"
                f" DATE_TRUNC('month', DATE_PARSE('{mes}', '%Y-%m')) + INTERVAL '1' MONTH AS fim"
            )
        else:
            mes_cte = (
                f"SELECT DATE_TRUNC('month', MAX(event_datetime)) AS inicio,"
                f" DATE_TRUNC('month', MAX(event_datetime)) + INTERVAL '1' MONTH AS fim"
                f" FROM {gz}.gold_events_triggers"
            )

        trigger_clauses: list[str] = []
        if cfg["trigger_include"]:
            inc = " OR ".join(f"LOWER(gt.trigger_desc) LIKE '%{t}%'" for t in cfg["trigger_include"])
            trigger_clauses.append(f"AND ({inc})")
        if cfg["trigger_exclude"]:
            for t in cfg["trigger_exclude"]:
                trigger_clauses.append(f"AND LOWER(gt.trigger_desc) NOT LIKE '%{t}%'")
        trigger_filter = "\n        ".join(trigger_clauses)

        min_filter = (
            f"AND date_diff('second', data_inicial, COALESCE(data_final, TIMESTAMP '2100-01-01 00:00:00')) >= {cfg['min_duration_sec']}"
            if cfg["min_duration_sec"] > 0 else ""
        )

        try:
            return trino.query_dict(f"""
WITH
mes AS ({mes_cte}),
hosts_grupo AS (
    SELECT DISTINCT h.hostid, h.host
    FROM {sz}.hosts h
    JOIN {sz}.hosts_groups hg ON hg.hostid = h.hostid
    WHERE hg.groupid IN ({groups}) AND h.status = 0
),
eventos_brutos AS (
    SELECT gt.host_id, gt.trigger_id, gt.trigger_desc, gt.event_datetime, gt.event_value
    FROM {gz}.gold_events_triggers gt
    JOIN hosts_grupo hg ON hg.hostid = gt.host_id
    JOIN mes m ON gt.event_datetime >= m.inicio - INTERVAL '1' MONTH
             AND gt.event_datetime <  m.fim + INTERVAL '7' DAY
    WHERE TRUE {trigger_filter}
),
intervalos AS (
    SELECT
        t1.host_id, t1.trigger_id, t1.trigger_desc,
        t1.event_datetime          AS data_inicial,
        MIN(t2.event_datetime)     AS data_final
    FROM eventos_brutos t1
    LEFT JOIN eventos_brutos t2
        ON  t1.host_id    = t2.host_id
        AND t1.trigger_id = t2.trigger_id
        AND t2.event_value = 0
        AND t2.event_datetime > t1.event_datetime
    WHERE t1.event_value = 1
    GROUP BY t1.host_id, t1.trigger_id, t1.trigger_desc, t1.event_datetime
),
intervalos_no_mes AS (
    SELECT host_id, trigger_desc, data_inicial,
           COALESCE(data_final, TIMESTAMP '2100-01-01 00:00:00') AS data_final
    FROM intervalos i
    CROSS JOIN mes m
    WHERE i.data_inicial < m.fim
      AND COALESCE(i.data_final, TIMESTAMP '2100-01-01 00:00:00') >= m.inicio
      {min_filter}
)
SELECT
    h.host AS Host,
    i.trigger_desc AS Evento,
    i.data_inicial AS Inicio_Real,
    CASE WHEN i.data_final = TIMESTAMP '2100-01-01 00:00:00' THEN NULL ELSE i.data_final END AS Fim_Real,
    ROUND(CAST(date_diff('second', i.data_inicial,
        CASE WHEN i.data_final = TIMESTAMP '2100-01-01 00:00:00' THEN CURRENT_TIMESTAMP ELSE i.data_final END
    ) AS DOUBLE) / 3600.0, 4) AS Horas_Indisp_Real,
    GREATEST(i.data_inicial, m.inicio) AS Inicio_VI,
    LEAST(i.data_final, m.fim - INTERVAL '1' SECOND) AS Fim_VI,
    ROUND(CAST(date_diff('second',
        GREATEST(i.data_inicial, m.inicio),
        LEAST(i.data_final, m.fim - INTERVAL '1' SECOND)
    ) AS DOUBLE) / 3600.0, 4) AS Horas_Indisp_Auditor
FROM intervalos_no_mes i
CROSS JOIN mes m
JOIN hosts_grupo h ON h.hostid = i.host_id
ORDER BY Inicio_Real
""")
        except Exception:
            return []

    # --- EBA (KPI 03) — inventário: 3 fontes combinadas (grupos de host ilustrativos) ---
    if cod == "03":
        try:
            return trino.query_dict(_eba_03_sql())
        except Exception as exc:
            log.error("_fetch_detail_lines(03) — erro Trino: %s", exc)
            return []

    # --- Zabbix inventário ---
    if cod in _ZABBIX_INV_CONFIG:
        cfg = _ZABBIX_INV_CONFIG[cod]
        sz = _sz()
        groups = ", ".join(str(g) for g in cfg["groupids"])
        try:
            return trino.query_dict(
                f"SELECT h.host, {cfg['mbps']} AS mbps_comprometido"
                f" FROM {sz}.hosts h"
                f" JOIN {sz}.hosts_groups hg ON hg.hostid = h.hostid"
                f" WHERE hg.groupid IN ({groups}) AND h.status = 0"
                f" ORDER BY h.host"
            )
        except Exception:
            return []

    # --- TICKETING tickets ---
    if cod in _TICKETING_KPI_CONFIG:
        cfg = _TICKETING_KPI_CONFIG[cod]
        h = _ticketing()
        tipo = cfg["tipo"]
        svc_f = f"AND servico = '{cfg['servico']}'" if cfg["servico"] else ""

        # Duração formatada a partir de duas datas (varchar ISO): "Xd Yh"
        _dur_datas = (
            "CASE WHEN dt_abertura IS NOT NULL AND dt_abertura != ''"
            " AND COALESCE(dt_resolvido_real, dt_resolvido) IS NOT NULL AND COALESCE(dt_resolvido_real, dt_resolvido) != '' THEN"
            " CAST(date_diff('second',"
            "  TRY(date_parse(substr(dt_abertura,1,19),'%Y-%m-%dT%H:%i:%s')),"
            "  TRY(date_parse(substr(COALESCE(dt_resolvido_real, dt_resolvido),1,19),'%Y-%m-%dT%H:%i:%s'))"
            " ) / 86400 AS VARCHAR) || 'd '"
            " || CAST(date_diff('second',"
            "  TRY(date_parse(substr(dt_abertura,1,19),'%Y-%m-%dT%H:%i:%s')),"
            "  TRY(date_parse(substr(COALESCE(dt_resolvido_real, dt_resolvido),1,19),'%Y-%m-%dT%H:%i:%s'))"
            " ) % 86400 / 3600 AS VARCHAR) || 'h'"
            " ELSE NULL END"
        )

        def _dur_horas(col: str) -> str:
            """Duração formatada a partir de coluna em horas (varchar): 'Xd Yh Zmin'."""
            return (
                f"CASE WHEN TRY_CAST({col} AS DOUBLE) IS NOT NULL THEN"
                f" CAST(CAST(FLOOR(TRY_CAST({col} AS DOUBLE) / 24) AS BIGINT) AS VARCHAR) || 'd '"
                f" || CAST(CAST(FLOOR(TRY_CAST({col} AS DOUBLE)) AS BIGINT) % 24 AS VARCHAR) || 'h '"
                f" || CAST(CAST(ROUND((TRY_CAST({col} AS DOUBLE)"
                f" - FLOOR(TRY_CAST({col} AS DOUBLE))) * 60) AS BIGINT) AS VARCHAR) || 'min'"
                f" ELSE NULL END"
            )

        if tipo == "ea":
            if not mes:
                return []
            try:
                return trino.query_dict(
                    f"SELECT"
                    f" ticket_id AS Ticket_ID,"
                    f" cliente_descricao AS Cliente,"
                    f" cod_ref_externa AS Ref_Externa,"
                    f" dt_abertura AS DT_Abertura,"
                    f" COALESCE(dt_resolvido_real, dt_resolvido) AS DT_Resolvido,"
                    f" CASE WHEN COALESCE(dt_resolvido_real, dt_resolvido) IS NOT NULL AND COALESCE(dt_resolvido_real, dt_resolvido) != '' THEN 'Finalizado' ELSE 'Pendente' END AS Status,"
                    f" {_dur_datas} AS Duracao_em_Dias"
                    f" FROM {h}"
                    f" WHERE TRUE {svc_f}"
                    f" AND SUBSTR(dt_abertura, 1, 7) = '{mes}'"
                    f" ORDER BY dt_abertura DESC LIMIT 500"
                )
            except Exception:
                return []

        if tipo == "rt":
            if not mes:
                return []
            try:
                return trino.query_dict(
                    f"SELECT"
                    f" ticket_id AS Ticket_ID,"
                    f" cliente_descricao AS Cliente,"
                    f" cod_ref_externa AS Ref_Externa,"
                    f" dt_abertura AS DT_Abertura,"
                    f" COALESCE(dt_resolvido_real, dt_resolvido) AS DT_Resolvido,"
                    f" houve_reabertura AS Reaberto,"
                    f" {_dur_datas} AS Duracao_em_Dias"
                    f" FROM ("
                    f"   SELECT *, ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY COALESCE(dt_resolvido_real, dt_resolvido) DESC) AS rn"
                    f"   FROM {h}"
                    f"   WHERE TRUE {svc_f}"
                    f"   AND COALESCE(dt_resolvido_real, dt_resolvido) IS NOT NULL AND COALESCE(dt_resolvido_real, dt_resolvido) != ''"
                    f"   AND SUBSTR(dt_abertura, 1, 7) = '{mes}'"
                    f" ) WHERE rn = 1"
                    f" ORDER BY dt_abertura DESC LIMIT 500"
                )
            except Exception:
                return []

        if tipo == "sat":
            if not mes:
                return []
            col = cfg["col"]
            try:
                return trino.query_dict(
                    f"SELECT"
                    f" ticket_id AS Ticket_ID,"
                    f" cliente_descricao AS Cliente,"
                    f" cod_ref_externa AS Ref_Externa,"
                    f" dt_abertura AS DT_Abertura,"
                    f" COALESCE(dt_resolvido_real, dt_resolvido) AS DT_Resolvido,"
                    f" CASE WHEN {col} IN ('Excelente', 'Bom') THEN 'Positivo' ELSE 'Negativo' END AS Status,"
                    f" {col} AS Avaliacao,"
                    f" {_dur_datas} AS Duracao_em_Dias"
                    f" FROM {h}"
                    f" WHERE TRUE {svc_f}"
                    f" AND {col} IS NOT NULL AND {col} != ''"
                    f" AND SUBSTR(dt_abertura, 1, 7) = '{mes}'"
                    f" ORDER BY dt_abertura DESC LIMIT 500"
                )
            except Exception:
                return []

        if tipo == "tr":
            if not mes:
                return []
            try:
                return trino.query_dict(
                    f"SELECT"
                    f" Ticket_ID, Cliente, Ref_Externa, DT_Abertura, DT_Triagem,"
                    f" tr_calculado AS Medicao,"
                    f" CASE WHEN tr_calculado IS NOT NULL THEN"
                    f"   CAST(CAST(FLOOR(tr_calculado / 24) AS BIGINT) AS VARCHAR) || 'd '"
                    f"   || CAST(CAST(FLOOR(tr_calculado) AS BIGINT) % 24 AS VARCHAR) || 'h '"
                    f"   || CAST(CAST(ROUND((tr_calculado - FLOOR(tr_calculado)) * 60) AS BIGINT) AS VARCHAR) || 'min'"
                    f" ELSE NULL END AS Duracao_em_Dias"
                    f" FROM ("
                    f"   SELECT"
                    f"     ticket_id AS Ticket_ID,"
                    f"     cliente_descricao AS Cliente,"
                    f"     cod_ref_externa AS Ref_Externa,"
                    f"     dt_abertura AS DT_Abertura,"
                    f"     dt_triagem AS DT_Triagem,"
                    f"     CASE WHEN dt_triagem IS NOT NULL AND dt_triagem != '' THEN"
                    f"       CAST(date_diff('second',"
                    f"         TRY(date_parse(substr(dt_abertura,1,19),'%Y-%m-%dT%H:%i:%s')),"
                    f"         TRY(date_parse(substr(dt_triagem,1,19),'%Y-%m-%dT%H:%i:%s'))"
                    f"       ) AS DOUBLE) / 3600.0"
                    f"     ELSE NULL END AS tr_calculado,"
                    f"     ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY dt_triagem DESC) AS rn"
                    f"   FROM {h}"
                    f"   WHERE TRUE {svc_f}"
                    f"   AND dt_triagem IS NOT NULL AND dt_triagem != ''"
                    f"   AND dt_abertura IS NOT NULL AND dt_abertura != ''"
                    f"   AND SUBSTR(dt_triagem, 1, 7) = '{mes}'"
                    f" ) WHERE rn = 1"
                    f" ORDER BY DT_Abertura DESC LIMIT 500"
                )
            except Exception:
                return []

        if tipo == "ts":
            if not mes:
                return []
            try:
                return trino.query_dict(
                    f"SELECT"
                    f" Ticket_ID, Cliente, Ref_Externa, Horas_Pendente_Cliente,"
                    f" DT_Abertura, DT_Resolvido,"
                    f" ts_calculado AS Medicao,"
                    f" CASE WHEN ts_calculado IS NOT NULL THEN"
                    f"   CAST(CAST(FLOOR(ts_calculado / 24) AS BIGINT) AS VARCHAR) || 'd '"
                    f"   || CAST(CAST(FLOOR(ts_calculado) AS BIGINT) % 24 AS VARCHAR) || 'h '"
                    f"   || CAST(CAST(ROUND((ts_calculado - FLOOR(ts_calculado)) * 60) AS BIGINT) AS VARCHAR) || 'min'"
                    f" ELSE NULL END AS Duracao_em_Dias"
                    f" FROM ("
                    f"   SELECT"
                    f"     ticket_id AS Ticket_ID,"
                    f"     cliente_descricao AS Cliente,"
                    f"     cod_ref_externa AS Ref_Externa,"
                    f"     horas_em_pendente_cliente AS Horas_Pendente_Cliente,"
                    f"     dt_abertura AS DT_Abertura,"
                    f"     COALESCE(dt_resolvido_real, dt_resolvido) AS DT_Resolvido,"
                    f"     CASE WHEN COALESCE(dt_resolvido_real, dt_resolvido) IS NOT NULL"
                    f"               AND COALESCE(dt_resolvido_real, dt_resolvido) != '' THEN"
                    f"       CAST(date_diff('second',"
                    f"         TRY(date_parse(substr(dt_abertura,1,19),'%Y-%m-%dT%H:%i:%s')),"
                    f"         TRY(date_parse(substr(COALESCE(dt_resolvido_real, dt_resolvido),1,19),'%Y-%m-%dT%H:%i:%s'))"
                    f"       ) AS DOUBLE) / 3600.0"
                    f"       - COALESCE(TRY_CAST(horas_em_pendente_cliente AS DOUBLE), 0.0)"
                    f"     ELSE NULL END AS ts_calculado"
                    f"   FROM {h}"
                    f"   WHERE TRUE {svc_f}"
                    f"   AND SUBSTR(dt_abertura, 1, 7) = '{mes}'"
                    f" )"
                    f" ORDER BY DT_Abertura DESC LIMIT 500"
                )
            except Exception:
                return []

    return []


# KPIs de inventário sem snapshot histórico: só exibir a partir do mês em que o
# fechamento passou a ser feito corretamente.
_HISTORICO_MIN_COMP: dict[str, str] = {
    "03": "2026-03",
    "06": "2026-03",
}


def get_kpi_historico(trino: TrinoClient, cod: str, meses: int) -> list[KpiHistoricoItem]:
    kpi = _COD_INDEX.get(cod)
    if not kpi:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Indicador {cod} não encontrado")
    schema = _ops()
    from datetime import date as _date
    mes_corrente = _date.today().strftime("%Y-%m")

    # Meses ingeridos oficialmente
    consolidado_rows = trino.query_dict(
        f"SELECT competencia, kpi_valor FROM {schema}.sla_meses_consolidado"
        f" WHERE cod = %s AND tipo = 'VALOR' ORDER BY competencia DESC",
        (cod,),
    )
    comps_consolidado = {str(r["competencia"]) for r in consolidado_rows}

    # Mês corrente ao vivo (apenas se ainda não estiver no consolidado)
    corrente_rows = []
    if mes_corrente not in comps_consolidado:
        corrente_rows = trino.query_dict(
            f"SELECT competencia, kpi_valor FROM {schema}.kpi_agg_test"
            f" WHERE cod = %s AND competencia = '{mes_corrente}' AND kpi_valor IS NOT NULL",
            (cod,),
        )

    rows = corrente_rows + consolidado_rows  # mais recente primeiro
    min_comp = _HISTORICO_MIN_COMP.get(cod)
    if min_comp:
        rows = [r for r in rows if str(r["competencia"]) >= min_comp]
    rows = rows[:meses]
    return [
        KpiHistoricoItem(
            competencia=str(r["competencia"]),
            valor=float(r["kpi_valor"]) if r["kpi_valor"] is not None else None,
            status=_eval_status(
                float(r["kpi_valor"]) if r["kpi_valor"] is not None else None,
                kpi["meta_val"], kpi["meta_op"], kpi.get("meta_val_alert"),
            ),
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Upsert helper
# ---------------------------------------------------------------------------

def _upsert(trino: TrinoClient, cod: str, competencia: str, valor: float | None) -> None:
    schema = _ops()
    trino.execute(
        f"DELETE FROM {schema}.kpi_agg_test WHERE cod = '{cod}' AND competencia = '{competencia}'"
    )
    valor_sql = str(valor) if valor is not None else "NULL"
    trino.execute(
        f"INSERT INTO {schema}.kpi_agg_test (cod, competencia, kpi_valor, updated_at)"
        f" VALUES ('{cod}', '{competencia}', {valor_sql}, CURRENT_TIMESTAMP)"
    )


# ---------------------------------------------------------------------------
# KPI 01 — MCFO (dados de manutenção importados/agregados)
# ---------------------------------------------------------------------------

def _refresh_mcfo(trino: TrinoClient, mes: str | None = None) -> None:
    schema = _ops()
    mes_filter = f"AND competencia_referencia = '{mes}'" if mes else (
        f"AND competencia_referencia = (SELECT MAX(competencia_referencia)"
        f" FROM {schema}.stage_mcfo_input WHERE deletado = false)"
    )
    rows = trino.query_dict(
        f"SELECT competencia_referencia AS comp,"
        f" SUM(nc) AS total_nc,"
        f" CEIL(SUM(extensao_km) / 10.0) AS m_total"
        f" FROM {schema}.stage_mcfo_input"
        f" WHERE deletado = false {mes_filter}"
        f" GROUP BY competencia_referencia"
    )
    if not rows:
        # Sem registros para o mês — registra NULL explícito para que o
        # frontend exiba "pending" em vez de um valor stale.
        if mes:
            _upsert(trino, "01", mes, None)
        return
    r = rows[0]
    valor = float(r["total_nc"]) / float(r["m_total"]) if r["m_total"] else None
    _upsert(trino, "01", str(r["comp"]), valor)


# ---------------------------------------------------------------------------
# KPI 02 — DMA  (billing + STATUS EQUIP/SINAL + falha de energia)
# ---------------------------------------------------------------------------

def _dma_cte_block(mes: str) -> str:
    """CTE block (sem WITH) reutilizável para valor do KPI e linhas de detalhe."""
    sz, gz, billing = _sz(), _gz(), _billing()
    return f"""
mes AS (
    SELECT
        DATE_TRUNC('month', DATE_PARSE('{mes}', '%Y-%m'))                       AS inicio,
        DATE_TRUNC('month', DATE_PARSE('{mes}', '%Y-%m')) + INTERVAL '1' MONTH  AS fim
),
evento_window AS (
    SELECT inicio - INTERVAL '2' MONTH AS ev_inicio,
           fim    + INTERVAL '7' DAY   AS ev_fim
    FROM mes
),
active_contracts AS (
    SELECT DISTINCT TRIM(SUBSTR(contrato, 1, STRPOS(contrato, '_'))) AS contrato_key
    FROM {billing}.cliente_contrato
    WHERE id_cliente IN ('1', '2') AND status = 'A' AND STRPOS(contrato, '_') > 0
      AND (data_ativacao IS NULL
           OR data_ativacao < DATE_FORMAT(CAST((SELECT fim FROM mes) AS DATE), '%Y-%m-%d'))
),
base_contratos AS (
    SELECT itemid, name, hostid, contrato_key
    FROM (
        SELECT i.itemid, i.name, i.hostid, c.contrato_key,
               ROW_NUMBER() OVER (PARTITION BY i.itemid ORDER BY LENGTH(c.contrato_key) DESC) AS rn
        FROM {sz}.items i
        INNER JOIN active_contracts c ON LOWER(i.name) LIKE '%' || LOWER(c.contrato_key) || '%'
        WHERE (i.name LIKE '%STATUS EQUIP%' OR i.name LIKE '%SINAL EQUIP%')
          AND i.name NOT LIKE '%PAP%' AND i.name NOT LIKE '%OCR%'
          AND i.name NOT LIKE '%LAB%' AND i.name NOT LIKE '%PTZ%'
    ) WHERE rn = 1
),
lista_item_ref_externa AS (
    SELECT REPLACE(bc.contrato_key, '_', '') AS Ref_Externa,
           bc.itemid, bc.hostid, bc.name, it.tag, it.value AS tag_value
    FROM base_contratos bc
    INNER JOIN {sz}.item_tag it ON bc.itemid = it.itemid
),
lista_items_pag_ont_status AS (
    SELECT DISTINCT Ref_Externa, itemid, name, hostid
    FROM lista_item_ref_externa
    WHERE name NOT LIKE '%PAP%' AND name NOT LIKE '%OCR%'
      AND name NOT LIKE '%LAB%' AND name NOT LIKE '%PTZ%'
      AND name NOT LIKE '%MANUTENCAO%'
      AND name NOT LIKE '%Desativado%'
      AND name NOT LIKE '%DESATIVADO%'
      AND (
            (name LIKE '%STATUS EQUIP%' AND tag = 'PAG' AND tag_value = '30M')
         OR (name LIKE '%SINAL EQUIP%'  AND tag = 'ONU' AND tag_value = 'Sinal')
      )
),
lista_hosts_pag_10 AS (
    SELECT DISTINCT z.Ref_Externa, z.hostid, z.host
    FROM (
        SELECT DISTINCT
            CASE
                WHEN h.host LIKE 'SITEA%' THEN 'S1' || lpad(regexp_extract(h.host, 'SW(\\d+)$', 1), 4, '0')
                WHEN h.host LIKE 'SITEB%' THEN 'S2' || lpad(regexp_extract(h.host, 'SW(\\d+)$', 1), 4, '0')
            END AS Ref_Externa,
            h.hostid, h.host
        FROM {sz}.hosts h
        INNER JOIN {sz}.hosts_groups hg ON h.hostid = hg.hostid
        WHERE hg.groupid = 207
          AND h.host NOT LIKE '%MANUTENCAO%'
          AND h.host NOT LIKE '%Desativado%'
          AND h.host NOT LIKE '%DESATIVADO%'
    ) z
    LEFT JOIN (
        SELECT DISTINCT
            TRIM(SUBSTR(contrato, 1, STRPOS(contrato, '_'))) AS contrato_key,
            MIN(data_ativacao) AS data_ativacao
        FROM {billing}.cliente_contrato
        WHERE id_cliente IN ('1', '2') AND STRPOS(contrato, '_') > 0
        GROUP BY TRIM(SUBSTR(contrato, 1, STRPOS(contrato, '_')))
    ) c ON z.Ref_Externa = c.contrato_key
    WHERE c.contrato_key IS NULL
       OR c.data_ativacao IS NULL
       OR c.data_ativacao < DATE_FORMAT(CAST((SELECT fim FROM mes) AS DATE), '%Y-%m-%d')
),
eventos_dg AS (
    SELECT DISTINCT s.Ref_Externa,
           CAST(e.event_datetime AT TIME ZONE 'America/Sao_Paulo' AS TIMESTAMP) AS event_data_time,
           e.event_value
    FROM {gz}.gold_events_triggers e
    INNER JOIN lista_items_pag_ont_status s ON e.host_id = s.hostid
    WHERE e.trigger_desc LIKE '%FALHA DE ENERGIA%'
      AND e.event_datetime >= (SELECT ev_inicio FROM evento_window)
      AND e.event_datetime <  (SELECT ev_fim    FROM evento_window)
),
power_failures AS (
    SELECT t1.Ref_Externa, t1.event_data_time AS power_start, MIN(t2.event_data_time) AS power_end
    FROM eventos_dg t1
    LEFT JOIN eventos_dg t2
        ON t1.Ref_Externa = t2.Ref_Externa
        AND t2.event_data_time > t1.event_data_time
        AND t2.event_value = 0
    WHERE t1.event_value = 1
    GROUP BY t1.Ref_Externa, t1.event_data_time
),
eventos_ont AS (
    SELECT s.Ref_Externa, e.item_id,
           CAST(e.event_datetime AT TIME ZONE 'America/Sao_Paulo' AS TIMESTAMP) AS event_data_time,
           e.event_value,
           CASE WHEN e.trigger_desc LIKE '%SINAL ÓPTICO BAIXO%' THEN 'ONT OFFLINE – SINAL ÓPTICO BAIXO'
                WHEN e.trigger_desc LIKE '%ABAIXO DO LIMIAR%' THEN 'ABAIXO DO LIMIAR'
                ELSE e.trigger_desc END AS trigger_desc,
           REPLACE(REPLACE(s.name, 'STATUS EQUIP ', ''), 'SINAL EQUIP ', '') AS host
    FROM {gz}.gold_events_triggers e
    INNER JOIN lista_items_pag_ont_status s ON e.item_id = s.itemid
    WHERE (e.trigger_desc LIKE '%SINAL ÓPTICO BAIXO%' OR e.trigger_desc LIKE '%ABAIXO DO LIMIAR%')
      AND e.event_datetime >= (SELECT ev_inicio FROM evento_window)
      AND e.event_datetime <  (SELECT ev_fim    FROM evento_window)
),
clean_events_ont AS (
    SELECT Ref_Externa, item_id, event_data_time, event_value, trigger_desc, host,
           LAG(event_value) OVER (PARTITION BY Ref_Externa, item_id ORDER BY event_data_time) AS prev_event_value
    FROM eventos_ont
),
events_power_check_ont AS (
    SELECT c.Ref_Externa, c.item_id, c.event_data_time, c.event_value,
           c.prev_event_value, c.trigger_desc, c.host,
           MAX(CASE WHEN pf.Ref_Externa IS NOT NULL
                     AND c.event_data_time >= pf.power_start
                     AND (c.event_data_time <= pf.power_end OR pf.power_end IS NULL)
                THEN 1 ELSE 0 END) AS is_during_power_failure
    FROM clean_events_ont c
    LEFT JOIN power_failures pf ON c.Ref_Externa = pf.Ref_Externa
    GROUP BY c.Ref_Externa, c.item_id, c.event_data_time, c.event_value,
             c.prev_event_value, c.trigger_desc, c.host
),
filtered_events_ont AS (
    SELECT Ref_Externa, item_id, event_data_time, event_value, trigger_desc, host
    FROM events_power_check_ont
    WHERE (event_value <> prev_event_value OR prev_event_value IS NULL)
      AND is_during_power_failure = 0
),
intervalos_ont AS (
    SELECT t1.Ref_Externa, t1.item_id, t1.event_data_time AS data_inicial,
           MIN(t2.event_data_time) AS data_final, t1.trigger_desc, t1.host
    FROM filtered_events_ont t1
    LEFT JOIN filtered_events_ont t2
        ON t1.item_id = t2.item_id AND t2.event_value = 0 AND t2.event_data_time > t1.event_data_time
    WHERE t1.event_value = 1
    GROUP BY t1.Ref_Externa, t1.item_id, t1.event_data_time, t1.trigger_desc, t1.host
    HAVING MIN(t2.event_data_time) IS NOT NULL
),
eventos_10g AS (
    SELECT h.Ref_Externa, e.item_id,
           CAST(e.event_datetime AT TIME ZONE 'America/Sao_Paulo' AS TIMESTAMP) AS event_data_time,
           e.event_value, e.trigger_desc, h.host
    FROM {gz}.gold_events_triggers e
    INNER JOIN lista_hosts_pag_10 h ON e.host_id = h.hostid
    WHERE e.trigger_desc NOT LIKE '%ICMP LOSS%'
      AND e.trigger_desc NOT LIKE '%Enlace down%'
      AND h.host NOT LIKE '%MANUTENCAO%'
      AND h.host NOT LIKE '%Desativado%'
      AND h.host NOT LIKE '%DESATIVADO%'
      AND e.event_datetime >= (SELECT ev_inicio FROM evento_window)
      AND e.event_datetime <  (SELECT ev_fim    FROM evento_window)
),
clean_events_10g AS (
    SELECT Ref_Externa, item_id, event_data_time, event_value, trigger_desc, host,
           LAG(event_value) OVER (PARTITION BY Ref_Externa, item_id ORDER BY event_data_time) AS prev_event_value
    FROM eventos_10g
),
events_power_check_10g AS (
    SELECT c.Ref_Externa, c.item_id, c.event_data_time, c.event_value,
           c.prev_event_value, c.trigger_desc, c.host,
           MAX(CASE WHEN pf.Ref_Externa IS NOT NULL
                     AND c.event_data_time >= pf.power_start
                     AND (c.event_data_time <= pf.power_end OR pf.power_end IS NULL)
                THEN 1 ELSE 0 END) AS is_during_power_failure
    FROM clean_events_10g c
    LEFT JOIN power_failures pf ON c.Ref_Externa = pf.Ref_Externa
    GROUP BY c.Ref_Externa, c.item_id, c.event_data_time, c.event_value,
             c.prev_event_value, c.trigger_desc, c.host
),
filtered_events_10g AS (
    SELECT Ref_Externa, item_id, event_data_time, event_value, trigger_desc, host
    FROM events_power_check_10g
    WHERE (event_value <> prev_event_value OR prev_event_value IS NULL)
      AND is_during_power_failure = 0
),
intervalos_10g AS (
    SELECT t1.Ref_Externa, t1.item_id, t1.event_data_time AS data_inicial,
           MIN(t2.event_data_time) AS data_final, t1.trigger_desc, t1.host
    FROM filtered_events_10g t1
    LEFT JOIN filtered_events_10g t2
        ON t1.item_id = t2.item_id AND t2.event_value = 0 AND t2.event_data_time > t1.event_data_time
    WHERE t1.event_value = 1
    GROUP BY t1.Ref_Externa, t1.item_id, t1.event_data_time, t1.trigger_desc, t1.host
    HAVING MIN(t2.event_data_time) IS NOT NULL
),
mart_disp_total_pag AS (
    SELECT Ref_Externa, host, trigger_desc, data_inicial, MAX(data_final) AS data_final
    FROM (
        SELECT Ref_Externa, host, trigger_desc, data_inicial, data_final FROM intervalos_ont
        UNION ALL
        SELECT Ref_Externa, host, trigger_desc, data_inicial, data_final FROM intervalos_10g
    )
    GROUP BY Ref_Externa, host, trigger_desc, data_inicial
),
tb_ind_02_raw AS (
    SELECT
        host AS Detalhamento,
        CASE WHEN trigger_desc LIKE '%EQUIPAMENTO - DOWN%' THEN 'EQUIPAMENTO - DOWN' ELSE trigger_desc END AS Texto_01,
        host AS Texto_02,
        CAST(NULL AS VARCHAR) AS Texto_03,
        CAST(NULL AS VARCHAR) AS Texto_04,
        Ref_Externa AS Texto_05,
        data_inicial AS DT_inicial,
        data_final   AS DT_final
    FROM mart_disp_total_pag
    WHERE data_inicial < (SELECT fim   FROM mes)
      AND (data_final IS NULL OR data_final >= (SELECT inicio FROM mes))
),
intervals_clipped AS (
    SELECT DISTINCT
        Detalhamento, Texto_01, Texto_02, Texto_03, Texto_04, Texto_05,
        DT_inicial AS DT_inicial_real,
        DT_final AS DT_final_real,
        GREATEST(DT_inicial, (SELECT inicio FROM mes)) AS DT_inicial,
        LEAST(
            COALESCE(DT_final, TIMESTAMP '2100-01-01 00:00:00'),
            (SELECT fim FROM mes) - INTERVAL '1' SECOND
        ) AS DT_final
    FROM tb_ind_02_raw
)"""


def _eba_03_sql() -> str:
    """SQL que retorna (Ref_Externa, host) para todos os sites do segmento A — 3 fontes de inventário combinadas (grupos de host ilustrativos)."""
    sz, billing = _sz(), _billing()
    return f"""
WITH
active_contracts AS (
    SELECT DISTINCT TRIM(SUBSTR(contrato, 1, STRPOS(contrato, '_'))) AS contrato_key
    FROM {billing}.cliente_contrato
    WHERE id_cliente IN ('1', '2') AND status = 'A' AND STRPOS(contrato, '_') > 0
),
base_contratos AS (
    SELECT itemid, name, hostid, contrato_key
    FROM (
        SELECT i.itemid, i.name, i.hostid, c.contrato_key,
               ROW_NUMBER() OVER (PARTITION BY i.itemid ORDER BY LENGTH(c.contrato_key) DESC) AS rn
        FROM {sz}.items i
        INNER JOIN active_contracts c ON LOWER(i.name) LIKE '%' || LOWER(c.contrato_key) || '%'
        WHERE (i.name LIKE '%STATUS EQUIP%' OR i.name LIKE '%SINAL EQUIP%')
          AND i.name NOT LIKE '%PAP%' AND i.name NOT LIKE '%OCR%'
          AND i.name NOT LIKE '%LAB%' AND i.name NOT LIKE '%PTZ%'
    ) WHERE rn = 1
),
lista_item_ref_externa AS (
    SELECT REPLACE(bc.contrato_key, '_', '') AS Ref_Externa,
           bc.itemid, bc.name, bc.hostid, it.tag, it.value AS tag_value
    FROM base_contratos bc
    INNER JOIN {sz}.item_tag it ON bc.itemid = it.itemid
),
lista_items_pag_ont_status AS (
    SELECT DISTINCT Ref_Externa, itemid, name, hostid
    FROM lista_item_ref_externa
    WHERE name NOT LIKE '%PAP%' AND name NOT LIKE '%OCR%'
      AND name NOT LIKE '%LAB%' AND name NOT LIKE '%PTZ%'
      AND name NOT LIKE '%MANUTENCAO%'
      AND name NOT LIKE '%Desativado%'
      AND name NOT LIKE '%DESATIVADO%'
      AND (
            (name LIKE '%STATUS EQUIP%' AND tag = 'PAG' AND tag_value = '30M')
         OR (name LIKE '%SINAL EQUIP%'  AND tag = 'ONU' AND tag_value = 'Sinal')
      )
),
lista_hosts_pag_r AS (
    SELECT DISTINCT
        CONCAT(
            COALESCE(REGEXP_EXTRACT(h.host, '^([A-Z]+)', 1), ''),
            LPAD(COALESCE(REGEXP_EXTRACT(h.host, '^[A-Z]+(\\d+)', 1), ''), 4, '0')
        ) AS Ref_Externa,
        h.host
    FROM {sz}.hosts h
    INNER JOIN {sz}.hosts_groups hg ON h.hostid = hg.hostid
    WHERE hg.groupid = 202
),
lista_hosts_pag_10 AS (
    SELECT DISTINCT
        CASE
            WHEN h.host LIKE 'SITEA%' THEN 'S1' || LPAD(REGEXP_EXTRACT(h.host, 'SW(\\d+)$', 1), 4, '0')
            WHEN h.host LIKE 'SITEB%' THEN 'S2' || LPAD(REGEXP_EXTRACT(h.host, 'SW(\\d+)$', 1), 4, '0')
        END AS Ref_Externa,
        h.host
    FROM {sz}.hosts h
    INNER JOIN {sz}.hosts_groups hg ON h.hostid = hg.hostid
    WHERE hg.groupid = 207
),
lista_items_pag_ont_as_hosts AS (
    SELECT DISTINCT
        Ref_Externa,
        REPLACE(name, 'STATUS EQUIP ', '') AS host
    FROM lista_items_pag_ont_status
    WHERE name LIKE '%STATUS EQUIP%'
      AND name NOT LIKE '%MANUTENCAO%'
      AND name NOT LIKE '%Desativado%'
      AND REPLACE(name, 'STATUS EQUIP ', '') NOT LIKE 'TIPOA%'
),
lista_total_pag AS (
    SELECT Ref_Externa, host FROM lista_hosts_pag_r
    UNION ALL
    SELECT Ref_Externa, host FROM lista_hosts_pag_10
    UNION ALL
    SELECT Ref_Externa, host FROM lista_items_pag_ont_as_hosts
)
SELECT Ref_Externa, host
FROM lista_total_pag
ORDER BY host
"""


def dma_intervals_sql(mes: str) -> str:
    """SQL que retorna 1 linha por intervalo de downtime (usado pelo zip_builder)."""
    return f"""WITH {_dma_cte_block(mes)}
SELECT
    CASE WHEN ROW_NUMBER() OVER (ORDER BY DT_inicial) = COUNT(*) OVER () THEN '02' ELSE '01' END
        AS ID_arquivo,
    Detalhamento, Texto_01, Texto_02, Texto_03, Texto_04, Texto_05,
    DT_inicial_real, DT_final_real,
    FLOOR(CAST(date_diff('second', DT_inicial_real, DT_final_real) AS DOUBLE) / 3600.0 * 1000) / 1000.0 AS Horas_Indisp_Real,
    DT_inicial, DT_final,
    FLOOR(CAST(date_diff('second', DT_inicial, DT_final) AS DOUBLE) / 3600.0 * 1000) / 1000.0 AS horas_indisponivel
FROM intervals_clipped
ORDER BY DT_inicial
"""


def _refresh_dma_02(trino: TrinoClient, mes: str | None = None) -> None:
    if mes is None:
        now = datetime.now()
        mes = f"{now.year}-{now.month - 1:02d}" if now.month > 1 else f"{now.year - 1}-12"
    log.info("_refresh_dma_02 iniciando para mes=%s", mes)
    sql = f"""WITH {_dma_cte_block(mes)},
all_contracts AS (
    SELECT DISTINCT Ref_Externa FROM lista_items_pag_ont_status
    UNION
    SELECT DISTINCT Ref_Externa FROM lista_hosts_pag_10 WHERE Ref_Externa IS NOT NULL
),
max_prev AS (
    SELECT Texto_05 AS Ref_Externa, DT_inicial, DT_final,
           MAX(DT_final) OVER (
               PARTITION BY Texto_05
               ORDER BY DT_inicial
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ) AS max_prev_end
    FROM intervals_clipped
    WHERE DT_final IS NOT NULL
),
island_labeled AS (
    SELECT Ref_Externa, DT_inicial, DT_final,
           SUM(CASE WHEN DT_inicial > max_prev_end OR max_prev_end IS NULL THEN 1 ELSE 0 END)
               OVER (PARTITION BY Ref_Externa ORDER BY DT_inicial) AS grp
    FROM max_prev
),
merged_intervals AS (
    SELECT Ref_Externa, MIN(DT_inicial) AS dt_ini, MAX(DT_final) AS dt_fim
    FROM island_labeled
    GROUP BY Ref_Externa, grp
),
downtime_per_contract AS (
    SELECT ac.Ref_Externa,
           COALESCE(SUM(date_diff('second', mi.dt_ini, mi.dt_fim)), 0) AS seg_down
    FROM all_contracts ac
    LEFT JOIN merged_intervals mi ON mi.Ref_Externa = ac.Ref_Externa
    GROUP BY ac.Ref_Externa
),
total AS (SELECT date_diff('second', inicio, fim) AS seg_mes FROM mes)
SELECT
    AVG(100.0 * (t.seg_mes - d.seg_down) / t.seg_mes) AS disp,
    DATE_FORMAT((SELECT inicio FROM mes), '%Y-%m') AS competencia
FROM downtime_per_contract d
CROSS JOIN total t
"""
    try:
        rows = trino.query_dict(sql)
    except Exception as exc:
        log.error("_refresh_dma_02 — erro Trino:\n%s\nSQL:\n%s", exc, sql)
        raise
    if rows and rows[0].get("disp") is not None:
        valor = float(rows[0]["disp"])
        comp = str(rows[0]["competencia"])
        log.info("_refresh_dma_02 resultado: competencia=%s disp=%.4f", comp, valor)
        _upsert(trino, "02", comp, valor)
    else:
        log.warning("_refresh_dma_02 retornou resultado vazio ou NULL para mes=%s — kpi_agg não atualizado", mes)


# ---------------------------------------------------------------------------
# KPIs Zabbix — disponibilidade (02, 04, 05, 07, 08)
# ---------------------------------------------------------------------------

# groupids: grupos Zabbix do host
# trigger_include: lista de termos que devem aparecer em trigger_desc (OR)
# trigger_exclude: lista de termos que NÃO devem aparecer (AND NOT)
# min_duration_sec: exclui eventos menores que N segundos (PABX = 900 = 15 min)
_ZABBIX_DISP_CONFIG: dict[str, dict] = {
    "02": {"groupids": [202, 206, 207, 208], "trigger_include": None,                         "trigger_exclude": ["energia", "power"],                            "min_duration_sec": 0},
    "04": {"groupids": [201],             "trigger_include": ["perda de sinal"],                "trigger_exclude": ["manutencao", "desativado"],                       "min_duration_sec": 0},
    "05": {"groupids": [203],             "trigger_include": ["timeout de ping"], "trigger_exclude": ["manutencao", "desativado"],                       "min_duration_sec": 0},
    "07": {"groupids": [204],             "trigger_include": ["perda de sinal"],                "trigger_exclude": ["manutencao", "desativado"],                       "min_duration_sec": 0},
    "08": {"groupids": [205],             "trigger_include": None,                         "trigger_exclude": ["manutencao", "desativado", "perda de sinal alta"], "min_duration_sec": 0},
}

# groupids: grupos; mbps: largura de banda por host (KPI de inventário)
_ZABBIX_INV_CONFIG: dict[str, dict] = {
    "06": {"groupids": [203], "mbps": 100.0},
}


def _refresh_zabbix_disp(trino: TrinoClient, cod: str, mes: str | None = None) -> None:
    if cod == "02":
        _refresh_dma_02(trino, mes)
        return
    cfg = _ZABBIX_DISP_CONFIG[cod]
    sz, gz = _sz(), _gz()
    groups = ", ".join(str(g) for g in cfg["groupids"])

    trigger_clauses: list[str] = []
    if cfg["trigger_include"]:
        inc = " OR ".join(f"LOWER(gt.trigger_desc) LIKE '%{t}%'" for t in cfg["trigger_include"])
        trigger_clauses.append(f"AND ({inc})")
    if cfg["trigger_exclude"]:
        for t in cfg["trigger_exclude"]:
            trigger_clauses.append(f"AND LOWER(gt.trigger_desc) NOT LIKE '%{t}%'")
    trigger_filter = "\n        ".join(trigger_clauses)

    min_filter = (
        f"AND date_diff('second', data_inicial, COALESCE(data_final, TIMESTAMP '2100-01-01 00:00:00')) >= {cfg['min_duration_sec']}"
        if cfg["min_duration_sec"] > 0 else ""
    )

    if mes:
        mes_cte = (
            f"SELECT DATE_TRUNC('month', DATE_PARSE('{mes}', '%Y-%m')) AS inicio,"
            f" DATE_TRUNC('month', DATE_PARSE('{mes}', '%Y-%m')) + INTERVAL '1' MONTH AS fim"
        )
    else:
        mes_cte = (
            f"SELECT DATE_TRUNC('month', MAX(event_datetime)) AS inicio,"
            f" DATE_TRUNC('month', MAX(event_datetime)) + INTERVAL '1' MONTH AS fim"
            f" FROM {gz}.gold_events_triggers"
        )

    sql = f"""
WITH
mes AS ({mes_cte}),
hosts_grupo AS (
    SELECT DISTINCT h.hostid
    FROM {sz}.hosts h
    JOIN {sz}.hosts_groups hg ON hg.hostid = h.hostid
    WHERE hg.groupid IN ({groups}) AND h.status = 0
),
eventos_brutos AS (
    SELECT gt.host_id, gt.trigger_id, gt.event_datetime, gt.event_value
    FROM {gz}.gold_events_triggers gt
    JOIN hosts_grupo hg ON hg.hostid = gt.host_id
    JOIN mes m ON gt.event_datetime >= m.inicio - INTERVAL '1' MONTH
             AND gt.event_datetime <  m.fim + INTERVAL '7' DAY
    WHERE TRUE {trigger_filter}
),
intervalos AS (
    SELECT
        t1.host_id,
        t1.trigger_id,
        t1.event_datetime          AS data_inicial,
        MIN(t2.event_datetime)     AS data_final
    FROM eventos_brutos t1
    LEFT JOIN eventos_brutos t2
        ON  t1.host_id    = t2.host_id
        AND t1.trigger_id = t2.trigger_id
        AND t2.event_value = 0
        AND t2.event_datetime > t1.event_datetime
    WHERE t1.event_value = 1
    GROUP BY t1.host_id, t1.trigger_id, t1.event_datetime
),
intervalos_no_mes AS (
    SELECT host_id, data_inicial,
           COALESCE(data_final, TIMESTAMP '2100-01-01 00:00:00') AS data_final
    FROM intervalos i
    CROSS JOIN mes m
    WHERE i.data_inicial < m.fim
      AND COALESCE(i.data_final, TIMESTAMP '2100-01-01 00:00:00') >= m.inicio
      {min_filter}
),
downtime_por_host AS (
    SELECT i.host_id,
           SUM(date_diff('second',
               GREATEST(i.data_inicial, m.inicio),
               LEAST(i.data_final, m.fim)
           )) AS seg_down
    FROM intervalos_no_mes i
    CROSS JOIN mes m
    GROUP BY i.host_id
),
total_seg AS (
    SELECT date_diff('second', inicio, fim) AS seg_mes,
           DATE_FORMAT(inicio, '%Y-%m') AS competencia
    FROM mes
)
SELECT
    AVG(100.0 * (ts.seg_mes - COALESCE(d.seg_down, 0)) / ts.seg_mes) AS disp,
    ts.competencia
FROM hosts_grupo hg
CROSS JOIN total_seg ts
LEFT JOIN downtime_por_host d ON d.host_id = hg.hostid
GROUP BY ts.competencia
"""
    rows = trino.query_dict(sql)
    if rows:
        _upsert(trino, cod, str(rows[0]["competencia"]), float(rows[0]["disp"]) if rows[0]["disp"] is not None else None)


def _refresh_zabbix_inv(trino: TrinoClient, cod: str, mes: str | None = None) -> None:
    cfg = _ZABBIX_INV_CONFIG[cod]
    sz = _sz()
    groups = ", ".join(str(g) for g in cfg["groupids"])
    comp = mes or datetime.now().strftime("%Y-%m")
    rows = trino.query_dict(
        f"SELECT COUNT(DISTINCT h.hostid) AS n"
        f" FROM {sz}.hosts h"
        f" JOIN {sz}.hosts_groups hg ON hg.hostid = h.hostid"
        f" WHERE hg.groupid IN ({groups}) AND h.status = 0"
    )
    _upsert(trino, cod, comp, float(rows[0]["n"]) if rows else None)


def _refresh_eba_03(trino: TrinoClient, mes: str | None = None) -> None:
    comp = mes or datetime.now().strftime("%Y-%m")
    try:
        rows = trino.query_dict(f"SELECT COUNT(*) AS n FROM ({_eba_03_sql()}) t")
    except Exception as exc:
        log.error("_refresh_eba_03 — erro Trino: %s", exc)
        raise
    if rows and rows[0].get("n") is not None:
        _upsert(trino, "03", comp, float(rows[0]["n"]))


# ---------------------------------------------------------------------------
# KPIs TICKETING (09–31) — satisfação, TR, TS, efetividade, reabertura
# ---------------------------------------------------------------------------

_TICKETING_KPI_CONFIG: dict[str, dict] = {
    "09": {"col": "qsos",  "tipo": "sat", "servico": None},
    "10": {"col": "qsat",  "tipo": "sat", "servico": None},
    "11": {"col": "qsri",  "tipo": "sat", "servico": "Voz"},
    "12": {"col": "tr",    "tipo": "tr",  "servico": "Enlace"},
    "13": {"col": "ts",    "tipo": "ts",  "servico": "Enlace"},
    "14": {"col": None,    "tipo": "ea",  "servico": "Enlace"},
    "15": {"col": None,    "tipo": "rt",  "servico": "Enlace"},
    "16": {"col": "tr",    "tipo": "tr",  "servico": "Voz"},
    "17": {"col": "ts",    "tipo": "ts",  "servico": "Voz"},
    "18": {"col": None,    "tipo": "ea",  "servico": "Voz"},
    "19": {"col": None,    "tipo": "rt",  "servico": "Voz"},
    "20": {"col": "tr",    "tipo": "tr",  "servico": "WiFi"},
    "21": {"col": "ts",    "tipo": "ts",  "servico": "WiFi"},
    "22": {"col": None,    "tipo": "ea",  "servico": "WiFi"},
    "23": {"col": None,    "tipo": "rt",  "servico": "WiFi"},
    "24": {"col": "tr",    "tipo": "tr",  "servico": "Video"},
    "25": {"col": "ts",    "tipo": "ts",  "servico": "Video"},
    "26": {"col": None,    "tipo": "ea",  "servico": "Video"},
    "27": {"col": None,    "tipo": "rt",  "servico": "Video"},
    "28": {"col": "tr",    "tipo": "tr",  "servico": "Extra"},
    "29": {"col": "ts",    "tipo": "ts",  "servico": "Extra"},
    "30": {"col": None,    "tipo": "ea",  "servico": "Extra"},
    "31": {"col": None,    "tipo": "rt",  "servico": "Extra"},
}

_EA_COD_TO_SVC: dict[str, str] = {
    "14": "Enlace", "18": "Voz", "22": "WiFi", "26": "Video", "30": "Extra"
}


def _refresh_ticketing_kpi_mes(trino: TrinoClient, cod: str, mes: str | None = None) -> None:
    cfg = _TICKETING_KPI_CONFIG.get(cod)
    if not cfg:
        return

    h = _ticketing()
    tipo, col, servico = cfg["tipo"], cfg["col"], cfg["servico"]
    svc_f = f"AND servico = '{servico}'" if servico else ""

    # Coluna de data por tipo — EA tem filtro próprio construído inline
    # TR usa dt_triagem; todos os outros usam COALESCE(dt_resolvido_real, dt_resolvido)
    # para atribuir o ticket ao mês correto quando o campo real estiver preenchido.
    if tipo == "tr":
        date_col = "dt_triagem"
    else:
        date_col = "COALESCE(dt_resolvido_real, dt_resolvido)"

    if mes:
        mes_f = f"AND SUBSTR({date_col}, 1, 7) = '{mes}'"
        comp_expr = f"'{mes}'"
    else:
        mes_f = (
            f"AND SUBSTR({date_col}, 1, 7) ="
            f" (SELECT MAX(SUBSTR({date_col}, 1, 7)) FROM {h}"
            f" WHERE {date_col} IS NOT NULL AND {date_col} != '' {svc_f})"
        )
        comp_expr = (
            f"(SELECT MAX(SUBSTR({date_col}, 1, 7)) FROM {h}"
            f" WHERE {date_col} IS NOT NULL AND {date_col} != '' {svc_f})"
        )

    # SAT, TS, RT: filtrar apenas pela data de abertura
    if tipo in ("sat", "ts", "rt") and mes:
        mes_f = f"AND SUBSTR(dt_abertura, 1, 7) = '{mes}'"

    if tipo == "sat":
        sql_val = (
            f"SELECT 100.0 * SUM(CASE WHEN {col} IN ('Excelente', 'Bom') THEN 1 ELSE 0 END)"
            f" / NULLIF(COUNT(*), 0) AS v, {comp_expr} AS comp"
            f" FROM ("
            f"   SELECT ticket_id, {col} FROM ("
            f"     SELECT ticket_id, {col},"
            f"       ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY COALESCE(dt_resolvido_real, dt_resolvido) DESC) AS rn"
            f"     FROM {h} WHERE {col} IS NOT NULL AND {col} != '' {svc_f} {mes_f}"
            f"   ) WHERE rn = 1"
            f" ) t"
        )
    elif tipo == "tr":
        sql_val = (
            f"SELECT AVG(tr_calculado) AS v, {comp_expr} AS comp"
            f" FROM ("
            f"   SELECT ticket_id,"
            f"     CAST(date_diff('second',"
            f"       TRY(date_parse(substr(dt_abertura,1,19),'%Y-%m-%dT%H:%i:%s')),"
            f"       TRY(date_parse(substr(dt_triagem,1,19),'%Y-%m-%dT%H:%i:%s'))"
            f"     ) AS DOUBLE) / 3600.0 AS tr_calculado,"
            f"     ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY dt_triagem DESC) AS rn"
            f"   FROM {h}"
            f"   WHERE dt_triagem IS NOT NULL AND dt_triagem != ''"
            f"     AND dt_abertura IS NOT NULL AND dt_abertura != '' {svc_f} {mes_f}"
            f" ) WHERE rn = 1"
        )
    elif tipo == "ts":
        sql_val = (
            f"SELECT AVG(ts_calculado) AS v, {comp_expr} AS comp"
            f" FROM ("
            f"   SELECT ticket_id,"
            f"     CAST(date_diff('second',"
            f"       TRY(date_parse(substr(dt_abertura,1,19),'%Y-%m-%dT%H:%i:%s')),"
            f"       TRY(date_parse(substr(COALESCE(dt_resolvido_real, dt_resolvido),1,19),'%Y-%m-%dT%H:%i:%s'))"
            f"     ) AS DOUBLE) / 3600.0"
            f"     - COALESCE(TRY_CAST(horas_em_pendente_cliente AS DOUBLE), 0.0) AS ts_calculado,"
            f"     ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY COALESCE(dt_resolvido_real, dt_resolvido) DESC) AS rn"
            f"   FROM {h}"
            f"   WHERE COALESCE(dt_resolvido_real, dt_resolvido) IS NOT NULL"
            f"     AND COALESCE(dt_resolvido_real, dt_resolvido) != '' {svc_f} {mes_f}"
            f" ) WHERE rn = 1"
        )
    elif tipo == "ea":
        # EA = (TF / TA) * 100
        # TA = tickets abertos no período
        # TF = tickets abertos no período que foram finalizados (mesmo coorte do TA)
        if mes:
            mes_ta = f"AND SUBSTR(dt_abertura, 1, 7) = '{mes}'"
            mes_tf = f"AND SUBSTR(dt_abertura, 1, 7) = '{mes}'"
            comp_e = f"'{mes}'"
        else:
            max_subq = (
                f"(SELECT MAX(SUBSTR(dt_abertura, 1, 7)) FROM {h}"
                f" WHERE dt_abertura IS NOT NULL AND dt_abertura != '' {svc_f})"
            )
            mes_ta = f"AND SUBSTR(dt_abertura, 1, 7) = {max_subq}"
            mes_tf = f"AND SUBSTR(dt_abertura, 1, 7) = {max_subq}"
            comp_e = max_subq
        sql_val = (
            f"SELECT 100.0 * tf.n / NULLIF(ta.n, 0) AS v, {comp_e} AS comp"
            f" FROM ("
            f"   SELECT COUNT(DISTINCT ticket_id) AS n FROM {h}"
            f"   WHERE COALESCE(dt_resolvido_real, dt_resolvido) IS NOT NULL AND COALESCE(dt_resolvido_real, dt_resolvido) != '' {svc_f} {mes_tf}"
            f" ) tf"
            f" CROSS JOIN ("
            f"   SELECT COUNT(DISTINCT ticket_id) AS n FROM {h}"
            f"   WHERE dt_abertura IS NOT NULL AND dt_abertura != '' {svc_f} {mes_ta}"
            f" ) ta"
        )
    elif tipo == "rt":
        sql_val = (
            f"SELECT 100.0 * SUM(CASE WHEN houve_reabertura = 'Sim' THEN 1 ELSE 0 END)"
            f" / NULLIF(COUNT(*), 0) AS v, {comp_expr} AS comp"
            f" FROM ("
            f"   SELECT ticket_id, houve_reabertura FROM ("
            f"     SELECT ticket_id, houve_reabertura,"
            f"       ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY COALESCE(dt_resolvido_real, dt_resolvido) DESC) AS rn"
            f"     FROM {h} WHERE COALESCE(dt_resolvido_real, dt_resolvido) IS NOT NULL AND COALESCE(dt_resolvido_real, dt_resolvido) != '' {svc_f} {mes_f}"
            f"   ) WHERE rn = 1"
            f" ) t"
        )
    else:
        return

    rows = trino.query_dict(sql_val)
    if rows and rows[0].get("comp"):
        comp = str(rows[0]["comp"])
        valor = float(rows[0]["v"]) if rows[0].get("v") is not None else None
        _upsert(trino, cod, comp, valor)


# ---------------------------------------------------------------------------
# Entry-points públicos
# ---------------------------------------------------------------------------

# Meses anteriores a este valor são importados via TXT histórico do sistema legado.
# O calculador não deve sobrescrever esses dados.
COMPETENCIA_MINIMA = "2026-06"


def refresh_kpi(trino: TrinoClient, cod: str, mes_override: str | None = None) -> None:
    if mes_override and mes_override < COMPETENCIA_MINIMA:
        log.warning(
            "refresh_kpi: mes '%s' anterior ao mínimo '%s' — ignorado (use ingestão histórica)",
            mes_override, COMPETENCIA_MINIMA,
        )
        return
    cache_invalidate()
    if cod == "01":
        _refresh_mcfo(trino, mes_override)
    elif cod == "03":
        _refresh_eba_03(trino, mes_override)
    elif cod in _ZABBIX_DISP_CONFIG:
        _refresh_zabbix_disp(trino, cod, mes_override)
    elif cod in _ZABBIX_INV_CONFIG:
        _refresh_zabbix_inv(trino, cod, mes_override)
    elif cod in _TICKETING_KPI_CONFIG:
        _refresh_ticketing_kpi_mes(trino, cod, mes_override)


def refresh_all_kpis(trino: TrinoClient, mes: str | None = None) -> None:
    """Recalcula todos os 31 KPIs sequencialmente.

    Iceberg commits concorrentes na mesma tabela kpi_agg geram ICEBERG_COMMIT_ERROR
    (delete files sobrepostos). Como o job roda 2x/dia em background, custo extra
    de ~60s/mês vs ~15s paralelo é irrelevante e elimina 100% dos conflitos.
    Mantemos 1 retry por KPI para cobrir falhas transientes de rede.
    """
    cods = [k["cod"] for k in KPI_CATALOG]
    failed: list[str] = []

    for cod in cods:
        for tentativa in (1, 2):
            try:
                refresh_kpi(trino, cod, mes)
                log.info("refresh_kpi(%s, mes=%s) OK", cod, mes)
                break
            except Exception as exc:
                if tentativa == 1:
                    log.warning("refresh_kpi(%s, mes=%s) tentativa %d falhou: %s — retentando", cod, mes, tentativa, exc)
                    _time.sleep(2)
                else:
                    log.error("refresh_kpi(%s, mes=%s) falhou após retry: %s", cod, mes, exc)
                    failed.append(cod)

    if failed:
        log.warning("KPIs com falha no refresh para mes=%s: %s", mes, failed)
    cache_invalidate()
