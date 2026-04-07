from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.database import get_pool
from app.models import TaskCreate, TaskLog, TaskResponse

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _row_to_task(row: Any) -> TaskResponse:
    """Convert an asyncpg Record to a TaskResponse, mapping DB column names."""
    d = dict(row)
    # Map DB column 'finished_at' -> model field 'completed_at'
    if "finished_at" in d:
        d["completed_at"] = d.pop("finished_at")
    return TaskResponse(**d)


def _row_to_log(row: Any) -> TaskLog:
    """Convert an asyncpg Record to a TaskLog, mapping DB column names."""
    d = dict(row)
    # Map DB column 'log_type' -> model field 'type'
    if "log_type" in d:
        d["type"] = d.pop("log_type")
    # Map DB column 'content' -> model field 'data'
    if "content" in d:
        d["data"] = d.pop("content")
    # Map DB column 'created_at' -> model field 'timestamp'
    if "created_at" in d:
        d["timestamp"] = d.pop("created_at")
    return TaskLog(**d)


@router.post("/", response_model=TaskResponse)
async def create_task(task: TaskCreate) -> TaskResponse:
    """Create a new task with status 'pending'."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO tasks (prompt, budget_cad, model)
           VALUES ($1, $2, COALESCE($3, 'claude-sonnet-4-20250514'))
           RETURNING *""",
        task.prompt,
        task.budget_cad,
        task.model,
    )
    return _row_to_task(row)


@router.get("/", response_model=list[TaskResponse])
async def list_tasks(limit: int = 50, offset: int = 0) -> list[TaskResponse]:
    """List tasks ordered by creation date (newest first)."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM tasks ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        limit,
        offset,
    )
    return [_row_to_task(row) for row in rows]


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: UUID) -> TaskResponse:
    """Retrieve a single task by ID."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM tasks WHERE id = $1", task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return _row_to_task(row)


@router.get("/{task_id}/logs", response_model=list[TaskLog])
async def get_task_logs(task_id: UUID) -> list[TaskLog]:
    """Retrieve logs for a task, ordered by creation date (oldest first)."""
    pool = await get_pool()

    # Verify the task exists first
    task = await pool.fetchrow("SELECT id FROM tasks WHERE id = $1", task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    rows = await pool.fetch(
        "SELECT * FROM task_logs WHERE task_id = $1 ORDER BY created_at ASC",
        task_id,
    )
    return [_row_to_log(row) for row in rows]
