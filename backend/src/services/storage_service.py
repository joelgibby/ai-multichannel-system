"""
Storage Service for managing file storage across different backends
"""
from typing import Any, Optional, Union

from ..config.settings import get_settings
from ..models.file_storage import FileStorage, FileType, StorageProvider
from .s3_service import S3Service, get_s3_service


class StorageService:
    """Service for managing file storage across different backends"""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._s3_service = get_s3_service

    async def upload(
        self,
        content: Union[bytes, str],
        filename: str,
        provider: Optional[StorageProvider] = None,
        file_type: Optional[FileType] = None,
        is_public: bool = False,
        metadata: Optional[dict[str, Any]] = None,
    ) -> FileStorage:
        if isinstance(content, str):
            content = content.encode("utf-8")

        s3_service = await self._s3_service()

        if file_type is None:
            file_type = s3_service.get_file_type_from_extension(filename)

        upload_result = await s3_service.upload_bytes(
            content=content,
            original_filename=filename,
        )
        resolved_provider = provider or upload_result.provider

        return FileStorage(
            original_filename=filename,
            stored_filename=upload_result.original_filename,
            file_type=file_type,
            mime_type=self._get_mime_type(filename),
            file_size_bytes=len(content),
            provider=resolved_provider,
            storage_path=upload_result.key,
            cid=upload_result.key if len(upload_result.key) <= 100 else None,
            url=upload_result.url,
            is_public=is_public,
        )

    async def download(
        self,
        storage_entry: FileStorage,
    ) -> bytes:
        s3_service = await self._s3_service()
        return await s3_service.download_file(
            key=storage_entry.storage_path,
        )

    async def delete(
        self,
        storage_entry: FileStorage,
    ) -> bool:
        s3_service = await self._s3_service()
        return await s3_service.delete_file(key=storage_entry.storage_path)

    def _get_mime_type(self, filename: str) -> str:
        import mimetypes

        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or "application/octet-stream"

    async def get_public_url(
        self,
        storage_entry: FileStorage,
    ) -> str:
        if storage_entry.url:
            return storage_entry.url

        s3_service = await self._s3_service()
        return s3_service._build_public_url(storage_entry.storage_path)


_storage_service: Optional[StorageService] = None


async def get_storage_service() -> StorageService:
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
