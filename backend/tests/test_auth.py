"""
Tests for authentication API endpoints.
"""

import pytest


@pytest.mark.asyncio
class TestRegistration:

    async def test_register_success(self, client):
        """Register a new user with valid phone and password."""
        resp = await client.post("/api/v1/auth/register", json={
            "phone": "01812345678",
            "password": "strongpass123",
            "full_name": "Test User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["phone"] == "01812345678"
        assert data["user"]["full_name"] == "Test User"
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_register_duplicate_phone(self, client):
        """Registering same phone twice should fail."""
        payload = {
            "phone": "01812345679",
            "password": "strongpass123",
            "full_name": "User One",
        }
        resp1 = await client.post("/api/v1/auth/register", json=payload)
        assert resp1.status_code == 201

        resp2 = await client.post("/api/v1/auth/register", json=payload)
        assert resp2.status_code in (400, 409)

    async def test_register_invalid_phone(self, client):
        """Invalid phone format should be rejected."""
        resp = await client.post("/api/v1/auth/register", json={
            "phone": "123",
            "password": "strongpass123",
            "full_name": "Bad Phone",
        })
        assert resp.status_code in (400, 422)

    async def test_register_short_password(self, client):
        """Password too short should be rejected."""
        resp = await client.post("/api/v1/auth/register", json={
            "phone": "01712345678",
            "password": "123",
            "full_name": "Short Pass",
        })
        assert resp.status_code in (400, 422)


@pytest.mark.asyncio
class TestLogin:

    async def test_login_success(self, client):
        """Login with valid credentials."""
        # First register
        await client.post("/api/v1/auth/register", json={
            "phone": "01812345690",
            "password": "testpass123",
            "full_name": "Login User",
        })
        # Then login
        resp = await client.post("/api/v1/auth/login", json={
            "phone": "01812345690",
            "password": "testpass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["phone"] == "01812345690"

    async def test_login_wrong_password(self, client):
        """Login with wrong password should fail."""
        await client.post("/api/v1/auth/register", json={
            "phone": "01812345691",
            "password": "correctpass",
            "full_name": "Wrong Pass",
        })
        resp = await client.post("/api/v1/auth/login", json={
            "phone": "01812345691",
            "password": "wrongpass",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client):
        """Login with non-existent phone should fail."""
        resp = await client.post("/api/v1/auth/login", json={
            "phone": "01999999999",
            "password": "password",
        })
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestProtectedRoutes:

    async def test_get_me_authenticated(self, client, guardian_token):
        """GET /auth/me should return user info when authenticated."""
        resp = await client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {guardian_token}",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "phone" in data

    async def test_get_me_unauthenticated(self, client):
        """GET /auth/me without token should fail."""
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code in (401, 403)

    async def test_get_me_invalid_token(self, client):
        """GET /auth/me with bad token should fail."""
        resp = await client.get("/api/v1/auth/me", headers={
            "Authorization": "Bearer invalid.token.here",
        })
        assert resp.status_code in (401, 403)
