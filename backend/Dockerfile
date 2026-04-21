FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

# Run via entrypoint (migrations + uvicorn)
CMD ["./docker-entrypoint.sh"]
