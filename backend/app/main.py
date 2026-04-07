from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import close_db, init_db, init_tables


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup
    await init_db()
    await init_tables()
    Path(settings.workspace_dir).mkdir(parents=True, exist_ok=True)
    yield
    # Shutdown
    await close_db()


app = FastAPI(title="Mogbot", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers.tasks import router as tasks_router
from app.routers.ws import router as ws_router

app.include_router(tasks_router)
app.include_router(ws_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "Mogbot", "status": "mogging"}
