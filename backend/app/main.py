import logging
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.trino_client import TrinoClient
from app.jobs.refresh_kpis import run as refresh_kpis_job
from app.routers import auth, users, kpis, indicadores, envio, health, historico

log = logging.getLogger(__name__)

_TIMEZONE = "America/Sao_Paulo"
_SCHEDULE_HOURS = (7, 13)


def _ensure_log_tables() -> None:
    """Garante que tabelas idempotentes de log existam. Falha silenciosa se Trino fora."""
    schema = f"{settings.TRINO_CATALOG}.{settings.TRINO_SCHEMA_OPS}"
    try:
        c = TrinoClient()
        try:
            c.execute(
                f"""CREATE TABLE IF NOT EXISTS {schema}.controle_mes_fechado (
                    competencia VARCHAR,
                    dt_fechamento TIMESTAMP,
                    fechado_por VARCHAR
                ) WITH (format = 'PARQUET')"""
            )
            log.info("[startup] controle_mes_fechado verificada/criada")
            c.execute(
                f"""CREATE TABLE IF NOT EXISTS {schema}.kpi_agg_test (
                    cod VARCHAR,
                    competencia VARCHAR,
                    kpi_valor DOUBLE,
                    updated_at TIMESTAMP
                ) WITH (format = 'PARQUET')"""
            )
            log.info("[startup] kpi_agg_test verificada/criada")
        finally:
            c.close()
    except Exception as exc:
        log.warning("[startup] não foi possível garantir tabelas de log (Trino fora?): %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    threading.Thread(target=_ensure_log_tables, daemon=True).start()
    scheduler = BackgroundScheduler(timezone=_TIMEZONE)
    for hour in _SCHEDULE_HOURS:
        scheduler.add_job(
            refresh_kpis_job,
            CronTrigger(hour=hour, minute=0, timezone=_TIMEZONE),
            id=f"refresh_kpis_{hour:02d}h",
            name=f"Recálculo automático dos 31 KPIs às {hour:02d}h",
            misfire_grace_time=3600,
            coalesce=True,
            max_instances=1,
            replace_existing=True,
        )
    scheduler.add_job(
        refresh_kpis_job,
        DateTrigger(run_date=datetime.now() + timedelta(seconds=10)),
        id="refresh_kpis_warmup",
        name="Warmup pós-startup",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.start()
    log.info("[scheduler] iniciado — disparos diários às %s (%s) + warmup em 10s", _SCHEDULE_HOURS, _TIMEZONE)
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        log.info("[scheduler] encerrado")


app = FastAPI(title="SLA Monitoring Dashboard", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(kpis.router)
app.include_router(indicadores.router)
app.include_router(envio.router)
app.include_router(historico.router)
