"""Async code execution for Mogbot using subprocess."""

from __future__ import annotations

import asyncio


class CodeExecutor:
    """Execute code snippets in Python, bash, or JavaScript via subprocess."""

    def __init__(self, workdir: str) -> None:
        self.workdir = workdir

    async def execute(
        self, language: str, code: str, timeout: int = 30
    ) -> str:
        """Run code and return stdout+stderr (truncated).

        Args:
            language: One of 'python', 'bash', 'javascript'.
            code: The source code to execute.
            timeout: Maximum seconds before killing the process.

        Returns:
            Output string (max 10000 chars) or error string (max 5000 chars).
        """
        commands: dict[str, list[str]] = {
            "python": ["python3", "-c", code],
            "bash": ["bash", "-c", code],
            "javascript": ["node", "-e", code],
        }

        cmd = commands.get(language)
        if cmd is None:
            return f"Unsupported language: {language}"

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.workdir,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return f"Error: Execution timed out after {timeout} seconds"

            output = stdout.decode("utf-8", errors="replace")
            errors = stderr.decode("utf-8", errors="replace")

            if process.returncode != 0:
                combined = output + errors if output else errors
                return f"Error: {combined}"[:5000]

            return (output + errors)[:10000]

        except Exception as exc:
            return f"Error: {exc}"[:5000]
