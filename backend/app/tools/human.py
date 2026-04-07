"""Human-in-the-loop interaction for Mogbot via WebSocket callback."""

from __future__ import annotations

import asyncio
from typing import Any, Callable


class HumanInteraction:
    """Allows the agent to pause and request human input.

    The WebSocket handler calls provide_response() when the user replies,
    which unblocks the waiting ask() coroutine.
    """

    def __init__(self) -> None:
        self._callback: Callable[..., Any] | None = None
        self._response_event: asyncio.Event | None = None
        self._response: str | None = None

    def set_callback(self, callback: Callable[..., Any]) -> None:
        """Set the callback used to notify the frontend that input is needed."""
        self._callback = callback

    async def ask(
        self, question: str, ask_type: str, context: str = ""
    ) -> str:
        """Request human input and block until a response arrives.

        Args:
            question: What the agent needs from the human.
            ask_type: Category (captcha, login, 2fa, decision, other).
            context: Additional context about why help is needed.

        Returns:
            The human's response string.
        """
        self._response = None
        self._response_event = asyncio.Event()

        # Notify the frontend via callback
        if self._callback:
            await self._callback(
                "human_input_needed",
                {
                    "question": question,
                    "type": ask_type,
                    "context": context,
                },
            )

        # Wait for the human to respond (via provide_response)
        await self._response_event.wait()
        return self._response or ""

    def provide_response(self, response: str) -> None:
        """Called by the WebSocket handler when the human responds."""
        self._response = response
        if self._response_event:
            self._response_event.set()

    def close(self) -> None:
        """Clean up any pending waits."""
        # Unblock any waiting ask() so it doesn't hang forever
        if self._response_event and not self._response_event.is_set():
            self._response = ""
            self._response_event.set()
