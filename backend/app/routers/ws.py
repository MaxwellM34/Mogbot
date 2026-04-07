from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.core.orchestrator import BudgetExceededError
from app.database import get_pool

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/run")
async def run_task(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time task execution.

    Protocol
    --------
    1. Client sends: {"type": "start", "task": "...", "budget_cad": 5.0, "model": "..."}
    2. Server responds with: {"type": "task_created", "task_id": "..."}
    3. Server streams events as: {"type": "<event_type>", "data": <payload>}
    4. Client may send: {"type": "human_response", "content": "..."} when prompted
    5. On completion: {"type": "result", "data": "..."} + {"type": "budget", "data": {...}}
    6. On failure: {"type": "error", "data": "..."}
    """
    await websocket.accept()

    task_id = None
    receiver: asyncio.Task | None = None
    orch = None

    try:
        # ----------------------------------------------------------------
        # 1. Receive the start message from the client
        # ----------------------------------------------------------------
        data = await websocket.receive_json()

        if data.get("type") != "start" or not data.get("task"):
            await websocket.send_json(
                {"type": "error", "data": "Expected message with type 'start' and a 'task' field"}
            )
            await websocket.close()
            return

        task_prompt: str = data["task"]
        budget_cad: float = data.get("budget_cad", 1.0)
        model: str = data.get("model", settings.default_model)

        # ----------------------------------------------------------------
        # 2. Create the task in the database (status: running)
        # ----------------------------------------------------------------
        pool = await get_pool()
        task_id = await pool.fetchval(
            "INSERT INTO tasks (prompt, status, budget_cad, model) "
            "VALUES ($1, 'running', $2, $3) RETURNING id",
            task_prompt,
            budget_cad,
            model,
        )

        # ----------------------------------------------------------------
        # 3. Send the task_id back to the client
        # ----------------------------------------------------------------
        await websocket.send_json({"type": "task_created", "task_id": str(task_id)})

        # ----------------------------------------------------------------
        # 4. Create the Orchestrator
        # ----------------------------------------------------------------
        from app.core.orchestrator import Orchestrator

        orch = Orchestrator(
            api_key=settings.anthropic_api_key,
            workdir=settings.workspace_dir,
            model=model,
        )
        orch.set_budget_cad(budget_cad)

        # ----------------------------------------------------------------
        # 5. Event callback: stream to WebSocket + persist to DB
        # ----------------------------------------------------------------
        async def on_event(event_type: str, event_data: object) -> None:
            # Send over WebSocket
            msg = {"type": event_type, "data": event_data}
            try:
                await websocket.send_json(msg)
            except Exception:
                logger.debug("Failed to send event over WebSocket", exc_info=True)

            # Persist log to task_logs table
            try:
                content = (
                    event_data
                    if isinstance(event_data, str)
                    else json.dumps(event_data, default=str)
                )
                await pool.execute(
                    "INSERT INTO task_logs (task_id, log_type, content) VALUES ($1, $2, $3)",
                    task_id,
                    event_type,
                    content,
                )
            except Exception:
                logger.debug("Failed to persist task log", exc_info=True)

        orch.set_event_callback(on_event)

        # ----------------------------------------------------------------
        # 6. Human-interaction queue: forward questions to WebSocket,
        #    wait for client responses via an asyncio.Queue.
        # ----------------------------------------------------------------
        async def receive_messages() -> None:
            """Background task that reads incoming WebSocket messages."""
            try:
                while True:
                    msg = await websocket.receive_json()
                    if msg.get("type") == "human_response":
                        orch.human.provide_response(msg.get("content", ""))
                    elif msg.get("type") == "browser_click":
                        x = msg.get("x", 0)
                        y = msg.get("y", 0)
                        await orch.browser.click_at(x, y)
                    elif msg.get("type") == "browser_type":
                        text = msg.get("text", "")
                        await orch.browser.type_keys(text)
                    elif msg.get("type") == "browser_key":
                        key = msg.get("key", "")
                        await orch.browser.press_key(key)
            except WebSocketDisconnect:
                pass
            except Exception:
                logger.debug("WebSocket receiver stopped", exc_info=True)

        # Start the background receiver
        receiver = asyncio.create_task(receive_messages())

        # ----------------------------------------------------------------
        # 7. Execute the task
        # ----------------------------------------------------------------
        try:
            result = await orch.run(task_prompt)

            # 8. Update task in DB with results
            budget = orch.get_budget()
            await pool.execute(
                """UPDATE tasks
                   SET status = 'completed',
                       result = $1,
                       spent_cad = $2,
                       input_tokens = $3,
                       output_tokens = $4,
                       finished_at = now()
                   WHERE id = $5""",
                result,
                round(budget.get_spent_cad(), 4),
                budget.input_tokens,
                budget.output_tokens,
                task_id,
            )

            # 9. Send final result + budget summary to the client
            await websocket.send_json({"type": "result", "data": result})
            await websocket.send_json(
                {
                    "type": "budget",
                    "data": {
                        "spent": budget.get_spent_cad(),
                        "total": budget.budget_cad,
                        "input_tokens": budget.input_tokens,
                        "output_tokens": budget.output_tokens,
                    },
                }
            )

        except BudgetExceededError as exc:
            budget = orch.get_budget()
            await pool.execute(
                """UPDATE tasks
                   SET status = 'budget_exceeded',
                       result = $1,
                       spent_cad = $2,
                       input_tokens = $3,
                       output_tokens = $4,
                       finished_at = now()
                   WHERE id = $5""",
                str(exc),
                round(budget.get_spent_cad(), 4),
                budget.input_tokens,
                budget.output_tokens,
                task_id,
            )
            await websocket.send_json({"type": "error", "data": str(exc)})
            await websocket.send_json(
                {
                    "type": "budget",
                    "data": {
                        "spent": budget.get_spent_cad(),
                        "total": budget.budget_cad,
                        "input_tokens": budget.input_tokens,
                        "output_tokens": budget.output_tokens,
                    },
                }
            )

        except Exception as exc:
            # Mark the task as failed in the database
            await pool.execute(
                "UPDATE tasks SET status = 'failed', result = $1, finished_at = now() WHERE id = $2",
                str(exc),
                task_id,
            )
            await websocket.send_json({"type": "error", "data": str(exc)})

        finally:
            if receiver is not None:
                receiver.cancel()
            if orch is not None:
                await orch.cleanup()

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected (task_id=%s)", task_id)
    except Exception as exc:
        logger.exception("Unhandled error in WebSocket handler")
        try:
            await websocket.send_json({"type": "error", "data": str(exc)})
        except Exception:
            pass
