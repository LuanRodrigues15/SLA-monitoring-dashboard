-- Run this script manually against Trino when provisioning the environment.
-- Replace 'iceberg.silver_ops' with your actual catalog.schema if different.
-- Usage: trino --execute "$(cat create_iceberg_tables.sql)"

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.users (
    id          VARCHAR,
    name        VARCHAR,
    email       VARCHAR,
    password_hash VARCHAR,
    role        VARCHAR,
    active      BOOLEAN,
    created_at  TIMESTAMP
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.stage_mcfo_input (
    id                    VARCHAR,
    trecho_origem         VARCHAR,
    trecho_destino        VARCHAR,
    dt_inicio             DATE,
    dt_final              DATE,
    nc                    INTEGER,
    extensao_km           DOUBLE,
    m                     INTEGER,
    mcfo_valor            DOUBLE,
    pontuacao             DOUBLE,
    competencia_referencia VARCHAR,
    usuario_email         VARCHAR,
    deletado              BOOLEAN,
    created_at            TIMESTAMP
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.controle_mes_fechado (
    competencia VARCHAR,
    fechado     BOOLEAN,
    updated_at  TIMESTAMP
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.chamados_sti (
    id_chamado        VARCHAR,
    titulo            VARCHAR,
    status            VARCHAR,
    categoria_servico VARCHAR,
    dt_abertura       VARCHAR,
    dt_resposta       VARCHAR,
    dt_resolucao      VARCHAR,
    reaberto          BOOLEAN,
    satisfacao        INTEGER,
    agente            VARCHAR
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.mart_disp_ap (
    host               VARCHAR,
    competencia        VARCHAR,
    down_seconds       BIGINT,
    total_sec          BIGINT,
    disponibilidade_pct DOUBLE
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.mart_disp_ptz (
    host               VARCHAR,
    competencia        VARCHAR,
    down_seconds       BIGINT,
    total_sec          BIGINT,
    disponibilidade_pct DOUBLE
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.mart_disp_pabx (
    host               VARCHAR,
    competencia        VARCHAR,
    down_seconds       BIGINT,
    total_sec          BIGINT,
    disponibilidade_pct DOUBLE
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.mart_disp_pag_remoto (
    host               VARCHAR,
    competencia        VARCHAR,
    down_seconds       BIGINT,
    total_sec          BIGINT,
    disponibilidade_pct DOUBLE
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.mart_disp_total_pag (
    host               VARCHAR,
    competencia        VARCHAR,
    down_seconds       BIGINT,
    total_sec          BIGINT,
    disponibilidade_pct DOUBLE
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.mart_disp_ocr (
    host               VARCHAR,
    competencia        VARCHAR,
    down_seconds       BIGINT,
    total_sec          BIGINT,
    disponibilidade_pct DOUBLE
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.kpi_agg (
    cod         VARCHAR,
    competencia VARCHAR,
    kpi_valor   DOUBLE,
    updated_at  TIMESTAMP
) WITH (format = 'PARQUET');

CREATE TABLE IF NOT EXISTS iceberg.silver_ops.tb_log_envio_sftp (
    id                  VARCHAR,
    usuario_email       VARCHAR,
    dt_envio            TIMESTAMP,
    indicadores_enviados ARRAY(VARCHAR),
    status              VARCHAR,
    mensagem_erro       VARCHAR,
    qtd_arquivos_ok     INTEGER
) WITH (format = 'PARQUET');

-- Snapshot imutável de tudo que foi enviado ao Auditor por mês fechado.
-- tipo = 'VALOR'  : 1 linha por KPI — kpi_valor preenchido (o que foi reportado)
-- tipo = 'DETALHE': N linhas por KPI — os 14 campos do TXT (tickets, eventos, inventário)
-- Meses abertos são calculados ao vivo (kpi_agg_test + TICKETING/Zabbix).
-- Meses fechados são lidos exclusivamente desta tabela — zero recálculo.
CREATE TABLE IF NOT EXISTS iceberg.silver_ops.sla_meses_consolidado (
    competencia  VARCHAR,
    cod          VARCHAR,
    tipo         VARCHAR,
    kpi_valor    DOUBLE,
    id_arquivo   VARCHAR,
    categoria    VARCHAR,
    detalhamento VARCHAR,
    texto_01     VARCHAR,
    texto_02     VARCHAR,
    texto_03     VARCHAR,
    texto_04     VARCHAR,
    texto_05     VARCHAR,
    dt_inicial   VARCHAR,
    dt_final     VARCHAR,
    medicao      VARCHAR,
    hora_arquivo VARCHAR
) WITH (format = 'PARQUET');
