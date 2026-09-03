"""
AI Service for interacting with LLM providers (OpenRouter, etc.)
"""
import asyncio
import json
import time
from typing import Any, AsyncGenerator, Optional

import httpx
from pydantic import BaseModel

from ..config.settings import get_settings
from ..models.message import MessageRole


class ChatMessage(BaseModel):
    """Message structure for AI chat"""
    role: MessageRole
    content: str = ""


class ChatRequest(BaseModel):
    """Request structure for AI chat"""
    model: Optional[str] = None
    messages: list[ChatMessage]
    temperature: float = 0.7
    max_tokens: int = 4096
    stream: bool = False
    # Additional parameters
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    repetition_penalty: Optional[float] = None
    stop: Optional[list[str]] = None


class ChatResponse(BaseModel):
    """Response structure from AI"""
    id: str
    model: str
    created: int
    content: str
    role: str
    finish_reason: str = "stop"
    usage: dict[str, Any] = {}
    latency_ms: float = 0.0


def _raise_for_openrouter(response: httpx.Response) -> None:
    """Raise a readable error that includes OpenRouter's response body."""
    if response.is_success:
        return
    detail: Any = response.text
    try:
        payload = response.json()
        error = payload.get("error")
        if isinstance(error, dict):
            detail = error.get("message") or error
        elif error:
            detail = error
        elif payload.get("message"):
            detail = payload["message"]
    except Exception:
        pass
    raise ValueError(f"OpenRouter {response.status_code}: {detail}")


class AIService:
    """Service for interacting with AI models via OpenRouter"""
    
    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(
            base_url=self.settings.OPENROUTER_BASE_URL.rstrip("/") + "/",
            timeout=120.0,
            headers={
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/your-username/ai-multichannel-system",
                "X-Title": "AI Multichannel System",
            },
        )
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    async def chat(
        self,
        messages: list[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = False,
        **kwargs: Any,
    ) -> ChatResponse:
        """
        Send a chat request to the AI model
        
        Args:
            messages: List of chat messages
            model: Model to use (defaults to settings.DEFAULT_AI_MODEL)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            **kwargs: Additional model parameters
            
        Returns:
            ChatResponse with the AI's response
        """
        if not self.settings.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not configured")
        
        model = model or self.settings.DEFAULT_AI_MODEL
        
        formatted_messages = [
            {
                "role": msg.role.value if hasattr(msg.role, "value") else str(msg.role),
                "content": msg.content or "",
            }
            for msg in messages
        ]
        
        request_data = {
            "model": model,
            "messages": formatted_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
            **kwargs,
        }
        
        headers = {
            "Authorization": f"Bearer {self.settings.OPENROUTER_API_KEY}",
        }
        
        start_time = time.time()
        
        if stream:
            # Handle streaming response
            response = await self._chat_stream(request_data, headers)
        else:
            # Handle non-streaming response
            response = await self._chat_non_stream(request_data, headers)
        
        latency_ms = (time.time() - start_time) * 1000
        
        choice = (response.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        return ChatResponse(
            id=response.get("id") or "",
            model=response.get("model") or model,
            created=response.get("created") or int(time.time()),
            content=message.get("content") or "",
            role=message.get("role") or "assistant",
            finish_reason=choice.get("finish_reason") or "stop",
            usage=response.get("usage") or {},
            latency_ms=latency_ms,
        )
    
    async def _chat_non_stream(self, request_data: dict, headers: dict) -> dict:
        """Handle non-streaming chat request"""
        response = await self.client.post(
            "chat/completions",
            json=request_data,
            headers=headers,
        )
        _raise_for_openrouter(response)
        return response.json()
    
    async def _chat_stream(
        self, request_data: dict, headers: dict
    ) -> dict:
        """Handle streaming chat request and aggregate the response"""
        full_response = ""
        usage = {}
        finish_reason = None
        model = request_data.get("model", "")
        
        async with self.client.stream(
            "POST",
            "chat/completions",
            json=request_data,
            headers=headers,
        ) as response:
            _raise_for_openrouter(response)
            async for line in response.aiter_lines():
                if line:
                    line = line.strip()
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            if "choices" in chunk:
                                delta = chunk["choices"][0].get("delta", {})
                                if "content" in delta:
                                    full_response += delta["content"]
                            if "usage" in chunk:
                                usage = chunk["usage"]
                            if "finish_reason" in chunk.get("choices", [{}])[0]:
                                finish_reason = chunk["choices"][0].get("finish_reason")
                        except json.JSONDecodeError:
                            continue
        
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "model": model,
            "created": int(time.time()),
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": full_response,
                },
                "finish_reason": finish_reason or "stop",
            }],
            "usage": usage,
        }
    
    async def chat_stream(
        self,
        messages: list[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat responses from the AI model
        
        Args:
            messages: List of chat messages
            model: Model to use
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            **kwargs: Additional model parameters
            
        Yields:
            Chunks of the AI's response as they arrive
        """
        if not self.settings.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not configured")
        
        model = model or self.settings.DEFAULT_AI_MODEL
        
        formatted_messages = [
            {
                "role": msg.role.value if hasattr(msg.role, "value") else str(msg.role),
                "content": msg.content or "",
            }
            for msg in messages
        ]
        
        request_data = {
            "model": model,
            "messages": formatted_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            **kwargs,
        }
        
        headers = {
            "Authorization": f"Bearer {self.settings.OPENROUTER_API_KEY}",
        }
        
        async with self.client.stream(
            "POST",
            "chat/completions",
            json=request_data,
            headers=headers,
        ) as response:
            _raise_for_openrouter(response)
            async for line in response.aiter_lines():
                if line:
                    line = line.strip()
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            if "choices" in chunk:
                                delta = chunk["choices"][0].get("delta", {})
                                if "content" in delta:
                                    yield delta["content"]
                        except json.JSONDecodeError:
                            continue
    
    async def list_models(self) -> list[dict[str, Any]]:
        """List available models from OpenRouter"""
        if not self.settings.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not configured")
        
        response = await self.client.get(
            "models",
            headers={
                "Authorization": f"Bearer {self.settings.OPENROUTER_API_KEY}",
            },
        )
        _raise_for_openrouter(response)
        return response.json().get("data", [])
    
    async def get_model_info(self, model_id: str) -> dict[str, Any]:
        """Get information about a specific model"""
        if not self.settings.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not configured")
        
        response = await self.client.get(
            f"models/{model_id}",
            headers={
                "Authorization": f"Bearer {self.settings.OPENROUTER_API_KEY}",
            },
        )
        _raise_for_openrouter(response)
        return response.json()
    
    async def close(self) -> None:
        """Close the HTTP client"""
        await self.client.aclose()


# Singleton instance
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """Get the AI service singleton"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
