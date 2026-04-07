from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class TaskCreate(BaseModel):
    prompt: str
    budget_cad: float
    model: str | None = None


class TaskResponse(BaseModel):
    id: UUID
    prompt: str
    status: str
    result: str | None
    budget_cad: float
    spent_cad: float
    input_tokens: int
    output_tokens: int
    model: str
    created_at: datetime
    finished_at: datetime | None


class TaskLog(BaseModel):
    id: int
    task_id: UUID
    log_type: str
    content: str
    created_at: datetime


class WSMessage(BaseModel):
    type: str
    data: Any = None
