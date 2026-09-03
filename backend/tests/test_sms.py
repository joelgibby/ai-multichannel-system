import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_multichannel",
)

from src.main import app, get_conversation_service_dep, get_sms_service_dep
from src.services.ai_service import ChatResponse
from src.services.conversation_service import (
    ConversationService,
    ai_response_text,
)
from src.services.sms_service import IncomingSMS, SMSService, truncate_sms_body


def test_ai_response_text_from_chat_response() -> None:
    response = ChatResponse(
        id="1",
        model="test",
        created=0,
        content="Hello from the model",
        role="assistant",
        finish_reason="stop",
        usage={},
        latency_ms=1.0,
    )
    assert ai_response_text(response) == "Hello from the model"


def test_ai_response_text_from_dict_and_missing() -> None:
    assert ai_response_text({"content": "dict reply"}) == "dict reply"
    assert ai_response_text(None) == "I received your message."
    assert ai_response_text(object()) == "I received your message."


def test_truncate_sms_body() -> None:
    assert truncate_sms_body("short") == "short"
    long_body = "a" * 1601
    trimmed = truncate_sms_body(long_body)
    assert len(trimmed) == 1600
    assert trimmed.endswith("…")


def test_generate_twiml_response_is_xml() -> None:
    twiml = SMSService.generate_twiml_response(SMSService(), "Hello there")
    assert twiml.startswith("<?xml") or twiml.startswith("<Response")
    assert "Hello there" in twiml
    assert "<Message>" in twiml


@pytest.mark.asyncio
async def test_process_sms_stores_once_and_does_not_rest_send() -> None:
    service = ConversationService()
    user_message = SimpleNamespace(id="user-1")
    assistant_message = SimpleNamespace(id="asst-1")
    conversation = SimpleNamespace(id="conv-1")

    service._get_or_create_sms_conversation = AsyncMock(return_value=conversation)
    service.add_message = AsyncMock(return_value=user_message)
    service.process_message = AsyncMock(
        return_value={
            "user_message": user_message,
            "assistant_message": assistant_message,
            "ai_response": ChatResponse(
                id="1",
                model="test",
                created=0,
                content="AI reply",
                role="assistant",
                finish_reason="stop",
                usage={},
                latency_ms=1.0,
            ),
        }
    )
    sms_client = MagicMock()
    service._sms_service = MagicMock(return_value=sms_client)

    incoming = IncomingSMS(
        message_sid="SM123",
        from_="+15551234567",
        to="+15557654321",
        body="Hi",
    )
    result = await service.process_sms(incoming)

    assert result["response_text"] == "AI reply"
    assert result["conversation_id"] == "conv-1"
    assert result["user_message_id"] == "user-1"
    assert result["assistant_message_id"] == "asst-1"
    service.add_message.assert_awaited_once()
    service.process_message.assert_awaited_once()
    assert service.process_message.await_args.kwargs["existing_user_message"] is user_message
    sms_client.send_sms.assert_not_called()


def test_sms_webhook_returns_raw_twiml() -> None:
    class FakeSMS:
        def parse_incoming_sms(self, request_data: dict) -> IncomingSMS:
            return IncomingSMS(
                message_sid=request_data.get("MessageSid", "SM1"),
                from_=request_data.get("From", "+15551234567"),
                to=request_data.get("To", "+15557654321"),
                body=request_data.get("Body", ""),
            )

        def generate_twiml_response(self, body: str, media_urls=None) -> str:
            return f"<Response><Message>{body}</Message></Response>"

    class FakeConversation:
        async def process_sms(self, incoming: IncomingSMS) -> dict:
            return {"response_text": f"Echo: {incoming.body}"}

    app.dependency_overrides[get_sms_service_dep] = FakeSMS
    app.dependency_overrides[get_conversation_service_dep] = FakeConversation
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/sms/webhook",
                data={
                    "MessageSid": "SM999",
                    "From": "+15551234567",
                    "To": "+15557654321",
                    "Body": "ping",
                    "NumMedia": "0",
                },
            )
    finally:
        app.dependency_overrides.pop(get_sms_service_dep, None)
        app.dependency_overrides.pop(get_conversation_service_dep, None)

    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]
    assert response.text == "<Response><Message>Echo: ping</Message></Response>"


def test_sms_webhook_returns_twiml_on_error() -> None:
    class FakeSMS:
        def parse_incoming_sms(self, request_data: dict) -> IncomingSMS:
            raise ValueError("bad payload")

        def generate_twiml_response(self, body: str, media_urls=None) -> str:
            return f"<Response><Message>{body}</Message></Response>"

    app.dependency_overrides[get_sms_service_dep] = FakeSMS
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/sms/webhook",
                data={"From": "+15551234567", "To": "+15557654321", "Body": "ping"},
            )
    finally:
        app.dependency_overrides.pop(get_sms_service_dep, None)

    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]
    assert "couldn't process" in response.text
