"""
Tests for course and ebook endpoints.
"""

import pytest


@pytest.mark.asyncio
class TestCourseEndpoints:

    async def test_list_courses_public(self, client):
        """Public course listing should return 200."""
        resp = await client.get("/api/v1/courses/")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        assert "courses" in data

    async def test_list_courses_with_pagination(self, client):
        """Course listing supports pagination params."""
        resp = await client.get("/api/v1/courses/?page=1&page_size=5")
        assert resp.status_code == 200
        data = resp.json()
        assert "courses" in data
        assert "total" in data

    async def test_list_courses_with_search(self, client):
        """Course listing supports search."""
        resp = await client.get("/api/v1/courses/?search=abacus")
        assert resp.status_code == 200

    async def test_course_detail_not_found(self, client):
        """Non-existent course slug returns 404."""
        resp = await client.get("/api/v1/courses/nonexistent-course-slug-xyz")
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestEbookEndpoints:

    async def test_list_ebooks_public(self, client):
        """Public ebook listing should return 200."""
        resp = await client.get("/api/v1/ebooks/")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    async def test_ebook_detail_not_found(self, client):
        """Non-existent ebook slug returns 404."""
        resp = await client.get("/api/v1/ebooks/nonexistent-ebook-slug")
        assert resp.status_code == 404

    async def test_ebook_download_unauthenticated(self, client):
        """Download without auth should fail."""
        import uuid
        fake_id = str(uuid.uuid4())
        resp = await client.post(f"/api/v1/ebooks/{fake_id}/download")
        assert resp.status_code in (401, 403)
