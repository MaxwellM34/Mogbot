"""Mogbot orchestrator — the main agent loop."""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

import anthropic

from ..tools.definitions import TOOLS
from ..tools.browser import BrowserTool
from ..tools.code_exec import CodeExecutor
from ..tools.files import FileTool
from ..tools.human import HumanInteraction
from .budget import BudgetTracker

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are Mogbot — an autonomous AI agent that mogs every task it touches.
You have access to a real browser, code execution, and file system.

Core rules:
1. PLAN first — break complex tasks into steps
2. USE SCREENSHOTS after navigation to verify page state
3. CAPTCHA/LOGIN/2FA — use ask_human tool when you hit authentication walls
4. ERRORS — if a tool fails, try a different approach (max 3 attempts per step)
5. WORK INCREMENTALLY — verify each step before moving to the next
6. COMPLETE tasks by calling task_complete with a clear summary
7. Be relentless and efficient. You don't stop until it's done."""


class Orchestrator:
    """Drives the Mogbot agent loop: plan, act, observe, repeat."""

    def __init__(
        self,
        api_key: str,
        workdir: str,
        model: str = "claude-sonnet-4-20250514",
    ) -> None:
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model
        self.browser = BrowserTool()
        self.code_exec = CodeExecutor(workdir)
        self.files = FileTool(workdir)
        self.human = HumanInteraction()
        self.budget = BudgetTracker()
        self.max_iterations: int = 50
        self.messages: list[dict[str, Any]] = []
        self._event_callback: Callable[..., Any] | None = None

    # -- Configuration --------------------------------------------------------

    def set_budget_cad(self, amount: float) -> None:
        """Set the maximum budget in CAD for the next run."""
        self.budget.set_budget_cad(amount)

    def get_budget(self) -> BudgetTracker:
        """Return the budget tracker instance."""
        return self.budget

    def set_event_callback(self, callback: Callable[..., Any]) -> None:
        """Set the callback for streaming events to the frontend (WebSocket)."""
        self._event_callback = callback
        self.human.set_callback(callback)

    # -- Main loop ------------------------------------------------------------

    async def run(self, task: str) -> str:
        """Execute a task through the agent loop.

        Returns the final text result or an error/limit message.
        """
        logger.info("Mogbot locking in on task: %s", task)

        self.messages = [{"role": "user", "content": task}]
        self.budget.reset()

        await self._emit("log", f"Budget: ${self.budget.budget_cad:.2f} CAD")

        for step in range(self.max_iterations):
            # Budget gate
            if not self.budget.can_afford():
                msg = (
                    f"Task stopped — budget of "
                    f"${self.budget.budget_cad:.2f} CAD reached. "
                    f"{self.budget.summary()}"
                )
                logger.warning(msg)
                await self._emit("log", msg)
                await self.cleanup()
                return msg

            await self._emit("log", f"-- Step {step + 1} --")

            # Call the model
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=self.messages,
            )

            # Track token spend
            usage = self.budget.record_usage(
                self.model,
                response.usage.input_tokens,
                response.usage.output_tokens,
            )
            cost_line = (
                f"[cost] This call: ${usage['call_cost_cad']:.4f} CAD | "
                f"{self.budget.summary()}"
            )
            logger.info(cost_line)
            await self._emit("log", cost_line)
            await self._emit("budget", self.budget.summary())

            # Log any text blocks
            for block in response.content:
                if block.type == "text" and block.text:
                    logger.info("> %s", block.text)
                    await self._emit("assistant_text", block.text)

            # End turn — model finished without tool calls
            if response.stop_reason == "end_turn":
                text = "\n".join(
                    block.text
                    for block in response.content
                    if block.type == "text" and block.text
                )
                await self.cleanup()
                return text or "Task completed."

            # Tool use — execute each requested tool
            if response.stop_reason == "tool_use":
                # Add assistant message with all content blocks
                self.messages.append(
                    {
                        "role": "assistant",
                        "content": [
                            _block_to_dict(b) for b in response.content
                        ],
                    }
                )

                tool_results: list[dict[str, Any]] = []

                for block in response.content:
                    if block.type != "tool_use":
                        continue

                    tool_input = (
                        block.input
                        if isinstance(block.input, dict)
                        else {}
                    )
                    logger.info(
                        "[tool] %s(%s)",
                        block.name,
                        json.dumps(tool_input)[:100],
                    )
                    await self._emit(
                        "tool_call",
                        {"name": block.name, "input": tool_input},
                    )

                    result = await self._execute_tool(block.name, tool_input)

                    # Screenshot: return as image content block
                    if (
                        block.name == "browser_screenshot"
                        and isinstance(result, str)
                        and len(result) > 1000
                    ):
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": [
                                    {
                                        "type": "image",
                                        "source": {
                                            "type": "base64",
                                            "media_type": "image/jpeg",
                                            "data": result,
                                        },
                                    }
                                ],
                            }
                        )

                    # task_complete: return immediately
                    elif block.name == "task_complete":
                        logger.info("Task mogged!")
                        await self._emit("log", "Task mogged!")
                        result_str = (
                            result
                            if isinstance(result, str)
                            else json.dumps(result)
                        )
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result_str,
                            }
                        )
                        self.messages.append(
                            {"role": "user", "content": tool_results}
                        )
                        await self.cleanup()
                        return (
                            result.get("result", result_str)
                            if isinstance(result, dict)
                            else result_str
                        )

                    # Normal tool result
                    else:
                        result_str = (
                            result
                            if isinstance(result, str)
                            else json.dumps(result)
                        )
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result_str,
                            }
                        )

                self.messages.append({"role": "user", "content": tool_results})

        await self.cleanup()
        return "Hit the rep limit without finishing. Needs a harder mog."

    # -- Tool dispatch --------------------------------------------------------

    async def _execute_tool(self, name: str, input: dict[str, Any]) -> Any:
        """Route a tool call to the appropriate handler."""
        try:
            match name:
                case "browser_navigate":
                    return await self.browser.navigate(input["url"])
                case "browser_click":
                    return await self.browser.click(
                        input["selector"], input.get("method", "css")
                    )
                case "browser_type":
                    return await self.browser.type(
                        input["selector"],
                        input["text"],
                        input.get("press_enter", False),
                    )
                case "browser_scroll":
                    return await self.browser.scroll(
                        input["direction"], input.get("amount", 500)
                    )
                case "browser_screenshot":
                    return await self.browser.screenshot(
                        input.get("full_page", False)
                    )
                case "browser_read_page":
                    return await self.browser.read_page(
                        input.get("include_links", True),
                        input.get("include_inputs", True),
                    )
                case "browser_select":
                    return await self.browser.select(
                        input["selector"], input["value"]
                    )
                case "browser_back":
                    return await self.browser.back()
                case "execute_code":
                    return await self.code_exec.execute(
                        input["language"],
                        input["code"],
                        input.get("timeout_seconds", 30),
                    )
                case "file_read":
                    return await self.files.read(input["path"])
                case "file_write":
                    return await self.files.write(input["path"], input["content"])
                case "file_list":
                    return await self.files.list(input.get("path", "."))
                case "ask_human":
                    return await self.human.ask(
                        input["question"],
                        input["type"],
                        input.get("context", ""),
                    )
                case "task_complete":
                    return input
                case _:
                    return f"Unknown tool: {name}"
        except Exception as exc:
            logger.exception("Tool error in %s", name)
            return f"Tool error: {exc}"

    # -- Events ---------------------------------------------------------------

    async def _emit(self, event_type: str, data: Any) -> None:
        """Send an event to the frontend via the registered callback."""
        if self._event_callback:
            await self._event_callback(event_type, data)

    # -- Cleanup --------------------------------------------------------------

    async def cleanup(self) -> None:
        """Release browser and other resources."""
        await self.browser.close()
        self.human.close()


def _block_to_dict(block: Any) -> dict[str, Any]:
    """Convert an Anthropic content block to a plain dict for message history."""
    if block.type == "text":
        return {"type": "text", "text": block.text}
    elif block.type == "tool_use":
        return {
            "type": "tool_use",
            "id": block.id,
            "name": block.name,
            "input": block.input if isinstance(block.input, dict) else {},
        }
    # Fallback
    return {"type": block.type}
