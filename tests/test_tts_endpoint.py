"""
tests/test_tts_endpoint.py - Tests for the POST /tts ElevenLabs proxy endpoint.

Covers:
  - Happy path: valid text -> 200 + audio/mpeg
  - Empty text -> 400
  - Missing ELEVENLABS_API_KEY -> 503
  - ElevenLabs upstream error -> 502
  - Text is capped at 2500 chars before forwarding
"""

from __future__ import annotations
import types
import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_response(status_code: int, content: bytes = b"", text: str = ""):
    """Return a minimal httpx-Response-like object."""
    return types.SimpleNamespace(
        status_code=status_code,
        content=content,
        text=text,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tts_client(monkeypatch):
    """
    TestClient with ELEVENLABS_API_KEY set as a module-level constant.
    Patches directly on backend.main so load_dotenv cannot override it.
    """
    import backend.main as m
    monkeypatch.setattr(m, "ELEVENLABS_API_KEY", "test-key-123")
    return TestClient(m.app)


@pytest.fixture()
def tts_client_no_key(monkeypatch):
    """
    TestClient with ELEVENLABS_API_KEY blanked out.
    Patches the module-level constant directly so load_dotenv cannot
    repopulate it from .env during the test.
    """
    import backend.main as m
    monkeypatch.setattr(m, "ELEVENLABS_API_KEY", "")
    return TestClient(m.app)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_tts_happy_path(tts_client, monkeypatch):
    """POST /tts with valid text returns 200 audio/mpeg."""
    fake_audio = b"\xff\xfb\x90fake-mp3-bytes"

    async def fake_post(self, *args, **kwargs):
        return _make_mock_response(200, content=fake_audio)

    import httpx
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    resp = tts_client.post("/tts", json={"text": "Hello, this is your wellness plan."})

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    assert resp.headers["content-type"].startswith("audio/mpeg"), (
        f"Expected audio/mpeg, got {resp.headers['content-type']}"
    )
    assert resp.content == fake_audio


def test_tts_empty_text_returns_400(tts_client):
    """POST /tts with blank text returns 400."""
    resp = tts_client.post("/tts", json={"text": "   "})
    assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"


def test_tts_missing_api_key_returns_503(tts_client_no_key):
    """POST /tts without ELEVENLABS_API_KEY configured returns 503."""
    resp = tts_client_no_key.post("/tts", json={"text": "Some text"})
    assert resp.status_code == 503, f"Expected 503, got {resp.status_code}"
    assert "ELEVENLABS_API_KEY" in resp.json()["detail"]


def test_tts_upstream_error_returns_502(tts_client, monkeypatch):
    """When ElevenLabs returns non-200, /tts returns 502."""
    async def fake_post(self, *args, **kwargs):
        return _make_mock_response(401, text="Unauthorized")

    import httpx
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    resp = tts_client.post("/tts", json={"text": "Some text"})
    assert resp.status_code == 502, f"Expected 502, got {resp.status_code}"


def test_tts_text_capped_at_2500_chars(tts_client, monkeypatch):
    """Text longer than 2500 chars is truncated before being sent to ElevenLabs."""
    captured = {}

    async def fake_post(self, *args, **kwargs):
        captured["payload"] = kwargs.get("json", {})
        return _make_mock_response(200, content=b"fake-audio")

    import httpx
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    resp = tts_client.post("/tts", json={"text": "a" * 4000})

    assert resp.status_code == 200
    sent = captured["payload"]["text"]
    assert len(sent) == 2500, f"Expected 2500 chars sent, got {len(sent)}"
