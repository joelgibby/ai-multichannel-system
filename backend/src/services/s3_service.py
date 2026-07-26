"""
S3 object storage service with local filesystem fallback for development.
"""
import asyncio
import os
import uuid
from pathlib import Path
from typing import Any, Optional, Union

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError
from pydantic import BaseModel

from ..config.settings import get_settings
from ..models.file_storage import FileType, StorageProvider


class S3UploadResult(BaseModel):
    """Result of an object storage upload."""

    key: str
    url: str
    provider: StorageProvider
    file_size_bytes: int
    original_filename: str


class S3Service:
    """Service for uploading and retrieving files from S3-compatible storage."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: Optional[BaseClient] = None
        self._use_local_storage = not self.settings.S3_BUCKET
        if not self._use_local_storage:
            self._client = self._create_client()
        else:
            Path(self.settings.LOCAL_STORAGE_PATH).mkdir(parents=True, exist_ok=True)

    def _create_client(self) -> BaseClient:
        session = boto3.session.Session(
            aws_access_key_id=self.settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=self.settings.S3_SECRET_ACCESS_KEY,
            region_name=self.settings.S3_REGION,
        )
        client_kwargs: dict[str, Any] = {}
        if self.settings.S3_ENDPOINT_URL:
            client_kwargs["endpoint_url"] = self.settings.S3_ENDPOINT_URL
        return session.client("s3", **client_kwargs)

    def _build_object_key(self, original_filename: str) -> str:
        safe_name = Path(original_filename).name
        prefix = self.settings.S3_PREFIX.strip("/")
        if prefix:
            return f"{prefix}/{uuid.uuid4().hex}/{safe_name}"
        return f"{uuid.uuid4().hex}/{safe_name}"

    def _build_public_url(self, key: str) -> str:
        if self.settings.S3_PUBLIC_URL_BASE:
            base = self.settings.S3_PUBLIC_URL_BASE.rstrip("/")
            return f"{base}/{key}"

        if self._use_local_storage:
            base = self.settings.PUBLIC_API_BASE_URL.rstrip("/")
            return f"{base}/api/storage/{key}"

        if self.settings.S3_ENDPOINT_URL and self.settings.S3_BUCKET:
            endpoint = self.settings.S3_ENDPOINT_URL.rstrip("/")
            return f"{endpoint}/{self.settings.S3_BUCKET}/{key}"

        region = self.settings.S3_REGION
        bucket = self.settings.S3_BUCKET
        if region == "us-east-1":
            return f"https://{bucket}.s3.amazonaws.com/{key}"
        return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"

    def _local_path(self, key: str) -> Path:
        return Path(self.settings.LOCAL_STORAGE_PATH) / key

    async def upload_bytes(
        self,
        content: bytes,
        original_filename: str,
    ) -> S3UploadResult:
        key = self._build_object_key(original_filename)

        if self._use_local_storage:
            local_path = self._local_path(key)
            local_path.parent.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread(local_path.write_bytes, content)
            provider = StorageProvider.LOCAL
        else:
            assert self._client is not None
            await asyncio.to_thread(
                self._client.put_object,
                Bucket=self.settings.S3_BUCKET,
                Key=key,
                Body=content,
                ContentType=self._get_mime_type(original_filename),
            )
            provider = StorageProvider.S3

        return S3UploadResult(
            key=key,
            url=self._build_public_url(key),
            provider=provider,
            file_size_bytes=len(content),
            original_filename=original_filename,
        )

    async def download_file(self, key: str) -> bytes:
        if self._use_local_storage:
            local_path = self._local_path(key)
            if not local_path.exists():
                raise FileNotFoundError(f"File not found: {key}")
            return await asyncio.to_thread(local_path.read_bytes)

        assert self._client is not None
        try:
            response = await asyncio.to_thread(
                self._client.get_object,
                Bucket=self.settings.S3_BUCKET,
                Key=key,
            )
            return await asyncio.to_thread(response["Body"].read)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code in {"NoSuchKey", "404", "NotFound"}:
                raise FileNotFoundError(f"File not found: {key}") from exc
            raise

    async def delete_file(self, key: str) -> bool:
        if self._use_local_storage:
            local_path = self._local_path(key)
            if not local_path.exists():
                return False
            await asyncio.to_thread(os.remove, local_path)
            return True

        assert self._client is not None
        try:
            await asyncio.to_thread(
                self._client.delete_object,
                Bucket=self.settings.S3_BUCKET,
                Key=key,
            )
            return True
        except ClientError:
            return False

    def get_file_type_from_extension(self, filename: str) -> FileType:
        ext = Path(filename).suffix.lower()

        audio_exts = [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"]
        image_exts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"]
        video_exts = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv"]
        doc_exts = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"]

        if ext in audio_exts:
            return FileType.AUDIO
        if ext in image_exts:
            return FileType.IMAGE
        if ext in video_exts:
            return FileType.VIDEO
        if ext in doc_exts:
            return FileType.DOCUMENT
        if ext == ".txt":
            return FileType.TEXT
        return FileType.OTHER

    def _get_mime_type(self, filename: str) -> str:
        import mimetypes

        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or "application/octet-stream"


_s3_service: Optional[S3Service] = None


async def get_s3_service() -> S3Service:
    global _s3_service
    if _s3_service is None:
        _s3_service = S3Service()
    return _s3_service
