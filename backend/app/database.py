import asyncpg

from app.config import settings

pool: asyncpg.Pool | None = None


async def init_db() -> None:
    """Create the asyncpg connection pool."""
    global pool
    pool = await asyncpg.create_pool(dsn=settings.database_url)


async def close_db() -> None:
    """Close the asyncpg connection pool."""
    global pool
    if pool is not None:
        await pool.close()
        pool = None


async def get_pool() -> asyncpg.Pool:
    """Return the current connection pool. Raises if not initialised."""
    if pool is None:
        raise RuntimeError("Database pool is not initialised. Call init_db() first.")
    return pool


async def init_tables() -> None:
    """Create tables if they don't already exist (bootstrap without alembic)."""
    p = await get_pool()
    async with p.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                prompt TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                result TEXT,
                budget_cad NUMERIC(10,4) NOT NULL,
                spent_cad NUMERIC(10,4) DEFAULT 0,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
                created_at TIMESTAMPTZ DEFAULT now(),
                finished_at TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS task_logs (
                id BIGSERIAL PRIMARY KEY,
                task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
                log_type TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)
