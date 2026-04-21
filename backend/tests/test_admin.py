"""
Tests for admin-only endpoints — ensure RBAC works.
"""

import pytest


@pytest.mark.asyncio
class TestAdminAccess:

    async def test_admin_stats_as_admin(self, client, admin_token):
        """Admin user can access /admin/stats."""
        resp = await client.get("/api/v1/admin/stats", headers={
            "Authorization": f"Bearer {admin_token}",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "total_users" in data
        assert "total_orders" in data

    async def test_admin_stats_as_guardian(self, client, guardian_token):
        """Guardian user should NOT access admin endpoints."""
        resp = await client.get("/api/v1/admin/stats", headers={
            "Authorization": f"Bearer {guardian_token}",
        })
        assert resp.status_code == 403

    async def test_admin_stats_unauthenticated(self, client):
        """Unauthenticated user should NOT access admin endpoints."""
        resp = await client.get("/api/v1/admin/stats")
        assert resp.status_code in (401, 403)

    async def test_admin_users_list_as_guardian(self, client, guardian_token):
        """Guardian cannot list all users."""
        resp = await client.get("/api/v1/admin/users", headers={
            "Authorization": f"Bearer {guardian_token}",
        })
        assert resp.status_code == 403

    async def test_admin_orders_list_as_guardian(self, client, guardian_token):
        """Guardian cannot list all orders."""
        resp = await client.get("/api/v1/admin/orders", headers={
            "Authorization": f"Bearer {guardian_token}",
        })
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestAdminOrderStatus:

    async def test_update_order_status_as_guardian(self, client, guardian_token):
        """Guardian cannot update order status."""
        import uuid
        fake_order = str(uuid.uuid4())
        resp = await client.patch(f"/api/v1/admin/orders/{fake_order}/status", json={
            "status": "confirmed",
        }, headers={"Authorization": f"Bearer {guardian_token}"})
        assert resp.status_code == 403
