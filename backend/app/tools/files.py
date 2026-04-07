"""Path-safe file operations for Mogbot's workspace."""

from __future__ import annotations

import os
from pathlib import Path


class FileTool:
    """Read, write, and list files within a sandboxed working directory."""

    def __init__(self, workdir: str) -> None:
        self.workdir = Path(workdir).resolve()

    def _resolve(self, file_path: str) -> Path:
        """Resolve a path and verify it stays within the workdir."""
        resolved = (self.workdir / file_path).resolve()
        if not str(resolved).startswith(str(self.workdir)):
            raise ValueError("Path traversal not allowed")
        return resolved

    async def read(self, file_path: str) -> str:
        """Read a file and return its contents (first 50000 chars)."""
        resolved = self._resolve(file_path)
        return resolved.read_text(encoding="utf-8")[:50000]

    async def write(self, file_path: str, content: str) -> str:
        """Write content to a file, creating parent directories as needed."""
        resolved = self._resolve(file_path)
        resolved.parent.mkdir(parents=True, exist_ok=True)
        resolved.write_text(content, encoding="utf-8")
        return f"Written {len(content.encode('utf-8'))} bytes to {file_path}"

    async def list(self, dir_path: str = ".") -> list[str]:
        """List files and directories, prefixed with [dir] or [file]."""
        resolved = self._resolve(dir_path)
        entries: list[str] = []
        for entry in sorted(resolved.iterdir()):
            icon = "[dir]" if entry.is_dir() else "[file]"
            entries.append(f"{icon} {entry.name}")
        return entries
