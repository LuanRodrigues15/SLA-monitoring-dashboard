# Ops scripts

Scripts de manutenção e operação, executados manualmente fora da API — não fazem parte do fluxo principal do produto nem da demo pública (que roda 100% em modo mock, sem backend).

- `create_iceberg_tables.sql` — DDL das tabelas Iceberg usadas pelo backend.
- `ingestao_historico.py` — importa pacotes TXT do auditor para o histórico consolidado (backfill).
- `fechar_meses.py` — fecha competências mensais já consolidadas.
- `refresh_historico.py` / `refresh_meses_abertos.py` — recalcula KPIs de meses históricos/abertos sob demanda.
- `refresh_ticketing_all.py` / `retry_ticketing_failed.py` — reprocessa ingestão de tickets, incluindo retry de falhas.

São exemplos de scripts de operação (backfill, idempotência, retry) mantidos aqui como demonstração de maturidade operacional, sem vínculo com nenhum ambiente real.
