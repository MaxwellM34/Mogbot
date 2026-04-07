FROM python:3.12-slim AS base

# Install system deps (for playwright, asyncpg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 (for execute_code tool - javascript support)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]" 2>/dev/null || pip install --no-cache-dir .

# Install Playwright browsers
RUN pip install playwright && playwright install chromium && playwright install-deps chromium

# Copy application
COPY . .

# Create workspace directory
RUN mkdir -p /app/workspace

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
