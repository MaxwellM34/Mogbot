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
    error: str | None = None
    budget_cad: float
    spent_cad: float
    input_tokens: int
    output_tokens: int
    model: str
    created_at: datetime
    completed_at: datetime | None = None


class TaskLog(BaseModel):
    id: int
    task_id: UUID
    type: str
    data: str
    timestamp: datetime


class WSMessage(BaseModel):
    type: str
    data: Any = None
