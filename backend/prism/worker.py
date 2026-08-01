"""Celery worker for background tasks — memory curation, ingestion."""

from celery import Celery
from celery.schedules import crontab

from prism.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "prism_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "curator-daily": {
            "task": "prism.worker.tasks.run_curator",
            "schedule": crontab(hour=2, minute=0),
        },
    },
)


@celery_app.task(name="prism.worker.tasks.run_curator")
def run_curator() -> dict:
    """Daily memory curation task."""
    import asyncio

    from prism.agents.curator.agent import CuratorAgent

    agent = CuratorAgent()
    return asyncio.run(agent.run_full_curation())
