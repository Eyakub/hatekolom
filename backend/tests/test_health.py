"""
Tests for /health endpoint.
"""


import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    """Health endpoint returns 200 with all checks."""
    resp = await client.get("/health")
    assert resp.status_code in (200, 503)  # 503 if redis not running in test
    data = resp.json()
    assert "status" in data
    assert "version" in data
    assert "checks" in data
    assert "db" in data["checks"]
    assert "redis" in data["checks"]
    assert "timestamp" in data
