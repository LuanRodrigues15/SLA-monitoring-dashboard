"""
ingestao_historico.py — Importa pacote TXT do Auditor para sla_meses_consolidado.

Popula a tabela sla_meses_consolidado com dois tipos de linha por mês:
  tipo='VALOR'  : 1 por KPI — o valor agregado calculado (kpi_valor)
  tipo='DETALHE': N por KPI — as linhas brutas do TXT (tickets, eventos, inventário)

Também mantém kpi_agg_test atualizado (compatibilidade com gráfico histórico).
Meses inseridos são marcados em controle_mes_fechado.

Uso:
    cd backend
    .\.venv\Scripts\python.exe scripts\ingestao_historico.py ^
        --pacote "C:\...\Pacote_Indicadores_SLA_2026-05 2 - Enviar" ^
        --mes 2026-05

    # Somente relatório, sem gravar:
    .\.venv\Scripts\python.exe scripts\ingestao_historico.py ^
        --pacote "..." --mes 2026-05 --dry-run

Lógica de extração do valor agregado por tipo de KPI:
    mcfo        (01)       soma col[4] de linhas tipo=01
    zabbix_billing (02 DMA)  downtime col[8] keyed por Ref_Externa; host-list do EBA col[4]
    inv         (03, 06)   conta linhas tipo=01 com col[3] não-vazio
    zabbix      (04,05,07,08)  downtime col[3]; host-list do Trino por groupid
    sat         (09,10,11) % col[11] in {Excelente, Bom}
    tr / ts     (12-31)    tr=média de col[11]; ts=recalculo (dt_final-dt_inicial)-col[5]
    ea          (14,18,22,26,30) tipo=02: col[5]/col[4] x 100
    rt          (15,19,23,27,31) tipo=02: col[4]/col[5] x 100
    segd        (24-27)    sempre NULL
"""
from __future__ import annotations

import argparse
import calendar
import logging
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

SAT_POSITIVO = {"Excelente", "Bom"}
_BATCH_SIZE = 150  # máximo de VALUES por INSERT (evita limite de query no Trino)

KPI_TIPO: dict[str, str] = {
    "01": "mcfo",
    "02": "zabbix_billing",
    "03": "inv",
    "04": "zabbix",
    "05": "zabbix",
    "06": "inv",
    "07": "zabbix",
    "08": "zabbix",
    "09": "sat",
    "10": "sat",
    "11": "sat",
    "12": "tr",
    "13": "ts",
    "14": "ea",
    "15": "rt",
    "16": "tr",
    "17": "ts",
    "18": "ea",
    "19": "rt",
    "20": "tr",
    "21": "ts",
    "22": "ea",
    "23": "rt",
    "24": "segd",
    "25": "segd",
    "26": "segd",
    "27": "segd",
    "28": "tr",
    "29": "ts",
    "30": "ea",
    "31": "rt",
}


# ---------------------------------------------------------------------------
# Parsing de TXT
# ---------------------------------------------------------------------------

def _parse_rows(path: Path) -> list[list[str]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    rows = []
    for linha in text.replace("\r\n", "\n").split("\n"):
        linha = linha.strip()
        if linha:
            rows.append(linha.split("|"))
    return rows


def _safe_float(s: str) -> Optional[float]:
    try:
        return float(s.replace(",", ".").strip())
    except (ValueError, AttributeError):
        return None


# ---------------------------------------------------------------------------
# Extração do valor agregado por tipo de KPI
# ---------------------------------------------------------------------------

def _valor_mcfo(rows: list[list[str]]) -> Optional[float]:
    total = 0
    for r in rows:
        if len(r) > 4 and r[4].strip().lstrip("-").isdigit():
            total += int(r[4].strip())
    return float(total)


def _valor_inv(rows: list[list[str]]) -> Optional[float]:
    count = sum(1 for r in rows if len(r) > 3 and r[3].strip())
    return float(count) if count > 0 else None


def _valor_sat(rows: list[list[str]]) -> Optional[float]:
    vals = [r[11].strip() for r in rows if len(r) > 11 and r[11].strip()]
    if not vals:
        return None
    return round(sum(1 for v in vals if v in SAT_POSITIVO) / len(vals) * 100, 4)


def _valor_tr(rows: list[list[str]]) -> Optional[float]:
    """TR = média de col[11] (dt_triagem - dt_abertura já calculado pelo sistema legado, sem pendente)."""
    nums = [_safe_float(r[11]) for r in rows if len(r) > 11 and r[11].strip()]
    nums = [v for v in nums if v is not None]
    return round(sum(nums) / len(nums), 4) if nums else None


def _valor_ts(rows: list[list[str]]) -> Optional[float]:
    """TS = média de (dt_final - dt_inicial) - horas_pendente_cliente (col[5]).

    Usa as datas brutas do TXT em vez de col[11], pois o sistema legado gerou col[11]
    a partir da coluna 'ts' pré-calculada do TICKETING que estava incorreta para
    alguns tickets. O Auditor recomputa exatamente com essa fórmula.
    col[5] = horas_pendente_cliente (vazio = 0).
    """
    from datetime import datetime
    vals = []
    for r in rows:
        if len(r) < 11:
            continue
        try:
            ini = datetime.strptime(r[9].strip(), "%d/%m/%Y %H:%M:%S")
            fim = datetime.strptime(r[10].strip(), "%d/%m/%Y %H:%M:%S")
            pend = _safe_float(r[5]) if len(r) > 5 and r[5].strip() else 0.0
            vals.append((fim - ini).total_seconds() / 3600.0 - (pend or 0.0))
        except Exception:
            pass
    return round(sum(vals) / len(vals), 4) if vals else None


def _valor_ea(rows: list[list[str]]) -> Optional[float]:
    for r in rows:
        if len(r) > 5 and r[0].strip() == "02":
            ta, tf = _safe_float(r[4]), _safe_float(r[5])
            if ta and ta > 0 and tf is not None:
                return round(tf / ta * 100, 4)
    return None


def _valor_rt(rows: list[list[str]]) -> Optional[float]:
    for r in rows:
        if len(r) > 5 and r[0].strip() == "02":
            reab, total = _safe_float(r[4]), _safe_float(r[5])
            if total and total > 0 and reab is not None:
                return round(reab / total * 100, 4)
    return None


def _valor_zabbix_simples(
    rows: list[list[str]], cod: str, trino, total_horas_mes: float
) -> Optional[float]:
    from app.services.kpi_calculator import _ZABBIX_DISP_CONFIG, _sz
    cfg = _ZABBIX_DISP_CONFIG.get(cod, {})
    groupids = cfg.get("groupids", [])
    if not groupids:
        return None
    sz = _sz()
    groups = ", ".join(str(g) for g in groupids)
    host_rows = trino.query_dict(
        f"SELECT h.host FROM {sz}.hosts h"
        f" JOIN {sz}.hosts_groups hg ON hg.hostid = h.hostid"
        f" WHERE hg.groupid IN ({groups}) AND h.status = 0"
    )
    if not host_rows:
        log.warning("KPI %s: nenhum host no Trino para groupids=%s", cod, groupids)
        return None
    downtime: dict[str, float] = {}
    for r in rows:
        if len(r) > 11 and r[11].strip():
            v = _safe_float(r[11])
            if v is not None:
                # Usa col[5] (nome completo Zabbix) quando preenchido.
                # Fallback para col[3] (Ref_Externa curto) p/ KPIs sem col[5] (ex: PABX/04).
                key = r[5].strip() if len(r) > 5 and r[5].strip() else r[3].strip()
                if key:
                    downtime[key] = downtime.get(key, 0.0) + v
    avails = []
    for hr in host_rows:
        nome = str(hr["host"]).strip()
        # Match exato pelo nome completo; fallback por prefixo so para KPIs sem col[5]
        down = downtime.get(nome, downtime.get(nome.split("_")[0], 0.0))
        avails.append((total_horas_mes - down) / total_horas_mes * 100.0)
    return round(sum(avails) / len(avails), 4) if avails else None


def _valor_dma(
    dma_rows: list[list[str]], eba_rows: list[list[str]], total_horas_mes: float
) -> Optional[float]:
    """DMA: host-list do EBA col[4]; downtime do DMA col[8]."""
    total_hosts = [r[4].strip() for r in eba_rows if len(r) > 4 and r[4].strip()]
    if not total_hosts:
        log.warning("DMA: EBA sem hosts — impossível calcular")
        return None
    downtime: dict[str, float] = {}
    for r in dma_rows:
        if len(r) > 11 and r[8].strip() and r[11].strip():
            v = _safe_float(r[11])
            if v is not None:
                key = r[8].strip()
                downtime[key] = downtime.get(key, 0.0) + v
    avails = [(total_horas_mes - downtime.get(h, 0.0)) / total_horas_mes * 100.0
              for h in total_hosts]
    return round(sum(avails) / len(avails), 4) if avails else None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _total_horas_mes(mes: str) -> float:
    ano, m = int(mes[:4]), int(mes[5:7])
    return float(calendar.monthrange(ano, m)[1] * 24)


def _load_pacote(pacote_dir: Path) -> dict[str, list[list[str]]]:
    result: dict[str, list[list[str]]] = {}
    for f in sorted(pacote_dir.glob("*.txt")):
        cod = f.name[:2]
        result[cod] = _parse_rows(f)
        log.info("  Carregado %s — %d linhas", f.name, len(result[cod]))
    return result


def _esc(s: object) -> str:
    """Escapa string para uso em SQL Trino (aspas simples)."""
    return "'" + str(s or "").replace("'", "''") + "'"


# ---------------------------------------------------------------------------
# Escrita no banco
# ---------------------------------------------------------------------------

def _valor_atual_kpi_agg(trino, schema: str, cod: str, mes: str) -> Optional[float]:
    rows = trino.query_dict(
        f"SELECT kpi_valor FROM {schema}.kpi_agg_test"
        f" WHERE cod = '{cod}' AND competencia = '{mes}'"
        f" ORDER BY updated_at DESC LIMIT 1"
    )
    if rows and rows[0].get("kpi_valor") is not None:
        return float(rows[0]["kpi_valor"])
    return None


def _upsert_kpi_agg(trino, schema: str, cod: str, mes: str, valor: Optional[float]) -> None:
    """Mantém kpi_agg_test atualizado (usado pelo gráfico histórico e KPI cards)."""
    valor_sql = str(valor) if valor is not None else "NULL"
    trino.execute(f"DELETE FROM {schema}.kpi_agg_test WHERE cod = '{cod}' AND competencia = '{mes}'")
    trino.execute(
        f"INSERT INTO {schema}.kpi_agg_test (cod, competencia, kpi_valor, updated_at)"
        f" VALUES ('{cod}', '{mes}', {valor_sql}, CURRENT_TIMESTAMP)"
    )


def _limpar_consolidado(trino, schema: str, mes: str) -> None:
    """Remove entradas anteriores do mês em sla_meses_consolidado (re-ingestão segura)."""
    trino.execute(f"DELETE FROM {schema}.sla_meses_consolidado WHERE competencia = '{mes}'")


def _insert_valor(trino, schema: str, mes: str, cod: str, categoria: str, valor: Optional[float]) -> None:
    """Insere linha tipo='VALOR' em sla_meses_consolidado."""
    valor_sql = str(valor) if valor is not None else "NULL"
    trino.execute(
        f"INSERT INTO {schema}.sla_meses_consolidado"
        f" (competencia, cod, tipo, kpi_valor, id_arquivo, categoria,"
        f"  detalhamento, texto_01, texto_02, texto_03, texto_04, texto_05,"
        f"  dt_inicial, dt_final, medicao, hora_arquivo)"
        f" VALUES ({_esc(mes)}, {_esc(cod)}, 'VALOR', {valor_sql},"
        f"  NULL, {_esc(categoria)},"
        f"  NULL, NULL, NULL, NULL, NULL, NULL,"
        f"  NULL, NULL, NULL, NULL)"
    )


def _insert_detalhe_batch(
    trino, schema: str, mes: str, cod: str, rows: list[list[str]]
) -> None:
    """Insere linhas tipo='DETALHE' em sla_meses_consolidado (em lotes)."""
    if not rows:
        return

    cols = (
        "competencia, cod, tipo, kpi_valor, id_arquivo, categoria,"
        " detalhamento, texto_01, texto_02, texto_03, texto_04, texto_05,"
        " dt_inicial, dt_final, medicao, hora_arquivo"
    )

    def _row_values(r: list[str]) -> str:
        # Garante 14 colunas; preenche com '' se faltar
        while len(r) < 14:
            r.append("")
        return (
            f"({_esc(mes)}, {_esc(cod)}, 'DETALHE', NULL,"
            f" {_esc(r[0])}, {_esc(r[2])},"
            f" {_esc(r[3])}, {_esc(r[4])}, {_esc(r[5])}, {_esc(r[6])}, {_esc(r[7])}, {_esc(r[8])},"
            f" {_esc(r[9])}, {_esc(r[10])}, {_esc(r[11])}, {_esc(r[12])})"
        )

    for i in range(0, len(rows), _BATCH_SIZE):
        batch = rows[i: i + _BATCH_SIZE]
        values = ", ".join(_row_values(r) for r in batch)
        trino.execute(
            f"INSERT INTO {schema}.sla_meses_consolidado ({cols}) VALUES {values}"
        )


def _marcar_fechado(trino, schema: str, mes: str) -> None:
    trino.execute(f"DELETE FROM {schema}.controle_mes_fechado WHERE competencia = '{mes}'")
    trino.execute(
        f"INSERT INTO {schema}.controle_mes_fechado (competencia, fechado, updated_at)"
        f" VALUES ({_esc(mes)}, true, CURRENT_TIMESTAMP)"
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingesta pacote TXT histórico em sla_meses_consolidado + kpi_agg_test"
    )
    parser.add_argument("--pacote", required=True, help="Pasta do pacote TXT")
    parser.add_argument("--mes", required=True, help="Competência YYYY-MM (ex: 2026-05)")
    parser.add_argument("--dry-run", action="store_true", help="Exibe relatório sem gravar")
    args = parser.parse_args()

    pacote_dir = Path(args.pacote)
    mes = args.mes
    dry_run = args.dry_run

    if not pacote_dir.is_dir():
        log.error("Diretório não encontrado: %s", pacote_dir)
        sys.exit(1)

    total_horas = _total_horas_mes(mes)

    print()
    print("=" * 100)
    print(f"  INGESTÃO HISTÓRICA — {mes}  |  {total_horas:.0f}h no mês")
    print(f"  Pacote : {pacote_dir}")
    print(f"  Modo   : {'DRY-RUN (sem escrita)' if dry_run else 'GRAVAR (sla_meses_consolidado + kpi_agg_test)'}")
    print("=" * 100)

    log.info("Carregando TXTs do pacote...")
    txts = _load_pacote(pacote_dir)

    from app.core.trino_client import TrinoClient
    from app.services.kpi_calculator import KPI_CATALOG
    from app.config import settings

    schema = f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"

    trino = TrinoClient()
    resultados: list[tuple] = []  # (cod, sigla, tipo, valor_txt, valor_atual, n_detalhe)

    try:
        for kpi in KPI_CATALOG:
            cod = kpi["cod"]
            sigla = kpi["sigla"]
            tipo = KPI_TIPO.get(cod, "unknown")
            rows = txts.get(cod, [])

            # Calcula valor agregado a partir do TXT
            if tipo == "segd":
                valor = None
            elif tipo == "mcfo":
                valor = _valor_mcfo(rows)
            elif tipo == "inv":
                valor = _valor_inv(rows)
            elif tipo == "sat":
                valor = _valor_sat(rows)
            elif tipo == "tr":
                valor = _valor_tr(rows)
            elif tipo == "ts":
                # KPI 13 (TSA): recalcula a partir das datas — o Auditor apurou divergência neste KPI
                # pois o sistema legado usou a coluna 'ts' pré-calculada do TICKETING que estava incorreta.
                # Demais TS: usa col[11] direto para bater com o que o Auditor validou/aceitou.
                valor = _valor_ts(rows) if cod == "13" else _valor_tr(rows)
            elif tipo == "ea":
                valor = _valor_ea(rows)
            elif tipo == "rt":
                valor = _valor_rt(rows)
            elif tipo == "zabbix":
                valor = _valor_zabbix_simples(rows, cod, trino, total_horas)
            elif tipo == "zabbix_billing":
                valor = _valor_dma(rows, txts.get("03", []), total_horas)
            else:
                valor = None

            atual = _valor_atual_kpi_agg(trino, schema, cod, mes)
            n_detalhe = len(rows)
            resultados.append((cod, sigla, tipo, valor, atual, n_detalhe))

        # Relatório
        print()
        print(f"  {'COD':<5} {'SIGLA':<6} {'TIPO':<12} {'VALOR_TXT':>12} {'VALOR_ATUAL':>12} {'DELTA':>10} {'LINHAS':>7}  STATUS")
        print(f"  {'-'*5} {'-'*6} {'-'*12} {'-'*12} {'-'*12} {'-'*10} {'-'*7}  {'-'*8}")

        divergencias = 0
        for cod, sigla, tipo, valor, atual, n in resultados:
            v_txt = f"{valor:.4f}" if valor is not None else "NULL"
            v_atu = f"{atual:.4f}" if atual is not None else "NULL"
            if valor is not None and atual is not None:
                delta = valor - atual
                delta_str = f"{delta:+.4f}"
                status = "OK" if abs(delta) < 0.01 else "DIVERGE"
                if status == "DIVERGE":
                    divergencias += 1
            elif valor is None and atual is None:
                delta_str, status = "—", "ambos NULL"
            elif atual is None:
                delta_str, status = "—", "novo"
            else:
                delta_str, status = "—", "txt=NULL"
            print(f"  {cod:<5} {sigla:<6} {tipo:<12} {v_txt:>12} {v_atu:>12} {delta_str:>10} {n:>7}  {status}")

        print()
        print(f"  Total KPIs: {len(resultados)}  |  Divergências (delta >= 0.01): {divergencias}")
        print("=" * 100)

        if dry_run:
            print("\n  DRY-RUN concluído. Rode sem --dry-run para aplicar.\n")
            return

        print()
        resp = input("  Confirma a gravação em sla_meses_consolidado e kpi_agg_test? [s/N] ").strip().lower()
        if resp != "s":
            print("  Operação cancelada.")
            return

        print()
        log.info("Limpando entradas anteriores de %s em sla_meses_consolidado...", mes)
        _limpar_consolidado(trino, schema, mes)

        erros: list[str] = []
        for kpi in KPI_CATALOG:
            cod = kpi["cod"]
            sigla = kpi["sigla"]
            rows = txts.get(cod, [])
            valor = next(v for c, s, t, v, a, n in resultados if c == cod)
            categoria = kpi["nome"]

            try:
                # VALOR: grava em sla_meses_consolidado e mantém kpi_agg_test
                _insert_valor(trino, schema, mes, cod, categoria, valor)
                _upsert_kpi_agg(trino, schema, cod, mes, valor)

                # DETALHE: todas as linhas do TXT
                _insert_detalhe_batch(trino, schema, mes, cod, rows)

                log.info("  KPI %s (%s) — valor=%s, %d linhas detalhe", cod, sigla, valor, len(rows))
            except Exception as exc:
                log.error("  KPI %s ERRO: %s", cod, exc)
                erros.append(cod)

        if erros:
            log.error("KPIs com erro: %s — mês NÃO marcado como fechado.", erros)
            sys.exit(1)

        _marcar_fechado(trino, schema, mes)
        log.info("Mês %s marcado como fechado.", mes)
        log.info("=== CONCLUÍDO ===")

    finally:
        trino.close()


if __name__ == "__main__":
    main()
