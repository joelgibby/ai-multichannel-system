"""
Storage Service for managing file storage across different backends
"""
import asyncio
from typing import Any, Optional, Union

from ..config.settings import get_settings
from ..models.file_storage import FileStorage, FileType, StorageProvider
from .ipfs_service import IPFSService, get_ipfs_service


class StorageService:
    """Service for managing file storage across different backends"""
    
    def __init__(self):
        self.settings = get_settings()
        self._ipfs_service = get_ipfs_service
    
    async def upload(
        self,
        content: Union[bytes, str],
        filename: str,
        provider: StorageProvider = StorageProvider.IPFS,
        file_type: Optional[FileType] = None,
        is_public: bool = False,
        metadata: Optional[dict[str, Any]] = None,
    ) -> FileStorage:
        """
        Upload a file to storage
        
        Args:
            content: File content (bytes or string)
            filename: Original filename
            provider: Storage provider to use
            file_type: File type (auto-detected if not provided)
            is_public: Whether the file should be publicly accessible
            metadata: Additional metadata
            
        Returns:
            FileStorage entry
        """
        if isinstance(content, str):
            content = content.encode("utf-8")
        
        # Determine file type
        if file_type is None:
            ipfs_service = await self._ipfs_service()
            file_type = ipfs_service.get_file_type_from_extension(filename)
        
        # Upload based on provider
        if provider == StorageProvider.IPFS:
            ipfs_service = await self._ipfs_service()
            upload_result = await ipfs_service.upload_bytes(
                content=content,
                original_filename=filename,
            )
            
            # Create FileStorage entry
            return FileStorage(
                original_filename=filename,
                stored_filename=upload_result.original_filename,
                file_type=file_type,
                mime_type=self._get_mime_type(filename),
                file_size_bytes=len(content),
                provider=provider,
                storage_path=upload_result.cid,
                cid=upload_result.cid,
                url=upload_result.url,
                is_public=is_public,
                metadata=metadata or {},
            )
        else:
            raise ValueError(f"Provider {provider} not supported")
    
    async def download(
        self,
        storage_entry: FileStorage,
    ) -> bytes:
        """
        Download a file from storage
        
        Args:
            storage_entry: FileStorage entry
            
        Returns:
            File content as bytes
        """
        if storage_entry.provider == StorageProvider.IPFS:
            ipfs_service = await self._ipfs_service()
            return await ipfs_service.download_file(
                cid=storage_entry.cid or storage_entry.storage_path,
                filename=storage_entry.original_filename,
            )
        else:
            raise ValueError(f"Provider {storage_entry.provider} not supported")
    
    async def delete(
        self,
        storage_entry: FileStorage,
    ) -> bool:
        """
        Delete a file from storage
        
        Args:
            storage_entry: FileStorage entry
            
        Returns:
            Whether deletion was successful
        """
        if storage_entry.provider == StorageProvider.IPFS:
            ipfs_service = await self._ipfs_service()
            return await ipfs_service.delete_file(
                cid=storage_entry.cid or storage_entry.storage_path,
                provider=storage_entry.provider,
            )
        else:
            raise ValueError(f"Provider {storage_entry.provider} not supported")
    
    def _get_mime_type(self, filename: str) -> str:
        """Get MIME type from filename"""
        import mimetypes
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or "application/octet-stream"
    
    async def get_public_url(
        self,
        storage_entry: FileStorage,
    ) -> str:
        """
        Get a public URL for a file
        
        Args:
            storage_entry: FileStorage entry
            
        Returns:
            Public URL
        """
        if storage_entry.is_public and storage_entry.url:
            return storage_entry.url
        
        if storage_entry.provider == StorageProvider.IPFS:
            return f"{self.settings.IPFS_GATEWAY_URL}/{storage_entry.cid}/{storage_entry.original_filename}"
        
        return storage_entry.url or ""


# Singleton instance
_storage_service: Optional[StorageService] = None


async def get_storage_service() -> StorageService:
    """Get the storage service singleton"""
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
