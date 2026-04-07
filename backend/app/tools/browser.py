"""Async Playwright browser automation for Mogbot."""

from __future__ import annotations

import asyncio
import base64
from typing import Any

from playwright.async_api import async_playwright, Playwright, Browser, BrowserContext, Page


class BrowserTool:
    """Headless Chromium browser controlled via Playwright."""

    def __init__(self) -> None:
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    async def _init(self) -> None:
        """Lazy-initialize Playwright, browser, context, and page."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=["--window-size=1280,900"],
        )
        self._context = await self._browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
            ),
        )
        self._page = await self._context.new_page()

    async def _ensure_page(self) -> Page:
        """Return the active page, initializing if needed."""
        if self._page is None:
            await self._init()
        assert self._page is not None
        return self._page

    async def navigate(self, url: str) -> dict[str, str]:
        """Navigate to a URL and return the resulting url and title."""
        page = await self._ensure_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(1000)
        return {"url": page.url, "title": await page.title()}

    async def click(self, selector: str, method: str = "css") -> dict[str, str]:
        """Click an element by CSS selector or text content."""
        page = await self._ensure_page()
        if method == "text":
            await page.get_by_text(selector, exact=False).first.click(timeout=5000)
        else:
            await page.click(selector, timeout=5000)
        await page.wait_for_timeout(1000)
        return {"clicked": selector}

    async def type(
        self, selector: str, text: str, press_enter: bool = False
    ) -> dict[str, str]:
        """Type text into an input field, optionally pressing Enter."""
        page = await self._ensure_page()
        await page.fill(selector, text)
        if press_enter:
            await page.press(selector, "Enter")
        await page.wait_for_timeout(1000)
        return {"typed": text, "into": selector}

    async def scroll(self, direction: str, amount: int = 500) -> dict[str, Any]:
        """Scroll the page up or down by a pixel amount."""
        page = await self._ensure_page()
        delta = amount if direction == "down" else -amount
        await page.mouse.wheel(0, delta)
        await page.wait_for_timeout(500)
        return {"scrolled": direction, "pixels": amount}

    async def screenshot(self, full_page: bool = False) -> str:
        """Take a JPEG screenshot and return it as a base64 string."""
        page = await self._ensure_page()
        buffer = await page.screenshot(
            full_page=full_page, type="jpeg", quality=75
        )
        return base64.b64encode(buffer).decode("ascii")

    async def read_page(
        self, include_links: bool = True, include_inputs: bool = True
    ) -> dict[str, Any]:
        """Extract text content, links, and form inputs from the current page."""
        page = await self._ensure_page()

        content: dict[str, Any] = await page.evaluate(
            """({ includeLinks, includeInputs }) => {
                const text = document.body.innerText.slice(0, 15000);
                const links = [];
                const inputs = [];

                if (includeLinks) {
                    document.querySelectorAll('a[href]').forEach((a, i) => {
                        if (i < 50) {
                            links.push(
                                '[' + (a.textContent || '').trim().slice(0, 60) + '](' + a.href + ')'
                            );
                        }
                    });
                }

                if (includeInputs) {
                    document.querySelectorAll('input, textarea, select, button').forEach((el, i) => {
                        if (i < 30) {
                            const tag = el.tagName.toLowerCase();
                            const type = el.getAttribute('type') || '';
                            const name = el.getAttribute('name') || el.getAttribute('id') || '';
                            const placeholder = el.getAttribute('placeholder') || '';
                            const label = el.getAttribute('aria-label') || '';
                            const selector = el.id
                                ? '#' + el.id
                                : el.getAttribute('name')
                                    ? tag + '[name="' + el.getAttribute('name') + '"]'
                                    : tag + ':nth-of-type(' + (i + 1) + ')';
                            inputs.push(
                                tag + '[type=' + type + '] name="' + name +
                                '" placeholder="' + placeholder +
                                '" label="' + label +
                                '" -> selector: ' + selector
                            );
                        }
                    });
                }

                return {
                    url: window.location.href,
                    title: document.title,
                    text,
                    links,
                    inputs
                };
            }""",
            {"includeLinks": include_links, "includeInputs": include_inputs},
        )
        return content

    async def select(self, selector: str, value: str) -> dict[str, str]:
        """Select an option from a dropdown element."""
        page = await self._ensure_page()
        await page.select_option(selector, value)
        return {"selected": value}

    async def back(self) -> dict[str, str]:
        """Navigate back in browser history."""
        page = await self._ensure_page()
        await page.go_back()
        return {"navigated": "back"}

    async def close(self) -> None:
        """Shut down the browser and Playwright."""
        if self._browser:
            await self._browser.close()
            self._browser = None
            self._context = None
            self._page = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
