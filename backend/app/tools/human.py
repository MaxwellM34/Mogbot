"""Human-in-the-loop interaction for Mogbot via WebSocket callback."""

from __future__ import annotations

import asyncio
from typing import Any, Callable


class HumanInteraction:
    """Allows the agent to pause and request human input.

    The WebSocket handler calls provide_response() when the user replies,
    which unblocks the waiting ask() coroutine.

    When ask_type is captcha/login/2fa and a browser reference is available,
    screenshots are streamed to the frontend so the user can see and interact
    with the browser directly.
    """

    def __init__(self) -> None:
        self._callback: Callable[..., Any] | None = None
        self._response_event: asyncio.Event | None = None
        self._response: str | None = None
        self._streaming: bool = False
        self._browser: Any | None = None  # BrowserTool reference

    def set_callback(self, callback: Callable[..., Any]) -> None:
        """Set the callback used to notify the frontend that input is needed."""
        self._callback = callback

    def set_browser(self, browser: Any) -> None:
        """Set browser reference for screenshot streaming."""
        self._browser = browser

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

        # Start streaming browser screenshots if browser is available
        # and the ask type is one that benefits from visual interaction
        stream_task: asyncio.Task[None] | None = None
        if self._browser and ask_type in ("captcha", "login", "2fa"):
            self._streaming = True
            stream_task = asyncio.create_task(self._stream_screenshots())

        # Wait for the human to respond (via provide_response)
        await self._response_event.wait()

        # Stop streaming
        self._streaming = False
        if stream_task is not None:
            stream_task.cancel()
            try:
                await stream_task
            except asyncio.CancelledError:
                pass

        # Tell frontend streaming stopped
        if self._callback:
            await self._callback("browser_stream_stop", {})

        return self._response or ""

    async def _stream_screenshots(self) -> None:
        """Stream browser screenshots at ~2fps while waiting for human."""
        try:
            while self._streaming:
                if self._browser:
                    try:
                        screenshot_b64 = await self._browser.screenshot(full_page=False)
                        if self._callback and screenshot_b64:
                            await self._callback("browser_frame", {
                                "image": screenshot_b64,
                            })
                    except Exception:
                        pass
                await asyncio.sleep(0.5)  # 2 fps
        except asyncio.CancelledError:
            pass

    def provide_response(self, response: str) -> None:
        """Called by the WebSocket handler when the human responds."""
        self._response = response
        if self._response_event:
            self._response_event.set()

    def close(self) -> None:
        """Clean up any pending waits."""
        self._streaming = False
        # Unblock any waiting ask() so it doesn't hang forever
        if self._response_event and not self._response_event.is_set():
            self._response = ""
            self._response_event.set()
