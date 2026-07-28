import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_multichannel",
)

from src.main import app
from src.services.socket_service import get_socket_service


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["status"] == "healthy"


def test_socket_service_initializes() -> None:
    socket_service = get_socket_service()

    assert socket_service.sio is not None
    assert socket_service.get_asgi_app() is not None
    assert hasattr(socket_service, "broadcast_message")


def test_storage_upload_and_download(client: TestClient) -> None:
    response = client.post(
        "/api/storage/upload",
        files={"file": ("hello.txt", b"hello storage", "text/plain")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["key"]
    assert payload["data"]["provider"] in {"s3", "local"}

    download = client.get(f"/api/storage/{payload['data']['key']}")
    assert download.status_code == 200
    assert download.content == b"hello storage"
