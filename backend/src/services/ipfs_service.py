"""
IPFS Service for file storage using Web3.Storage and other IPFS providers
"""
import asyncio
import os
import tempfile
from pathlib import Path
from typing import Any, AsyncGenerator, Optional, Union

import aiohttp
from pydantic import BaseModel

from ..config.settings import get_settings
from ..models.file_storage import FileType, StorageProvider


class IPFSUploadResult(BaseModel):
    """Result of an IPFS upload"""
    cid: str
    url: str
    provider: StorageProvider
    file_size_bytes: int
    original_filename: str


class IPFSService:
    """Service for interacting with IPFS storage providers"""
    
    def __init__(self):
        self.settings = get_settings()
        self._web3_storage_client: Optional[Any] = None
    
    async def initialize(self) -> None:
        """Initialize the IPFS service"""
        if self.settings.WEB3_STORAGE_TOKEN:
            try:
                # Import web3.storage only when needed
                from web3.storage import Web3Storage
                self._web3_storage_client = Web3Storage(
                    token=self.settings.WEB3_STORAGE_TOKEN
                )
            except ImportError:
                pass
    
    async def upload_file(
        self,
        file_path: Union[str, Path],
        original_filename: Optional[str] = None,
        provider: StorageProvider = StorageProvider.IPFS,
    ) -> IPFSUploadResult:
        """
        Upload a file to IPFS
        
        Args:
            file_path: Path to the file to upload
            original_filename: Original filename (defaults to basename of file_path)
            provider: IPFS provider to use
            
        Returns:
            IPFSUploadResult with CID and URL
        """
        file_path = Path(file_path)
        original_filename = original_filename or file_path.name
        file_size_bytes = file_path.stat().st_size
        
        if provider == StorageProvider.IPFS and self._web3_storage_client:
            return await self._upload_to_web3_storage(
                file_path, original_filename, file_size_bytes
            )
        elif provider == StorageProvider.IPFS:
            return await self._upload_to_public_ipfs_gateway(
                file_path, original_filename, file_size_bytes
            )
        else:
            raise ValueError(f"Provider {provider} not supported")
    
    async def upload_bytes(
        self,
        content: bytes,
        original_filename: str,
        provider: StorageProvider = StorageProvider.IPFS,
    ) -> IPFSUploadResult:
        """
        Upload bytes to IPFS
        
        Args:
            content: File content as bytes
            original_filename: Original filename
            provider: IPFS provider to use
            
        Returns:
            IPFSUploadResult with CID and URL
        """
        # Write to temp file
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            tmp_file.write(content)
            tmp_path = Path(tmp_file.name)
        
        try:
            file_size_bytes = len(content)
            if provider == StorageProvider.IPFS and self._web3_storage_client:
                return await self._upload_to_web3_storage(
                    tmp_path, original_filename, file_size_bytes
                )
            elif provider == StorageProvider.IPFS:
                return await self._upload_to_public_ipfs_gateway(
                    tmp_path, original_filename, file_size_bytes
                )
            else:
                raise ValueError(f"Provider {provider} not supported")
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    
    async def _upload_to_web3_storage(
        self,
        file_path: Path,
        original_filename: str,
        file_size_bytes: int,
    ) -> IPFSUploadResult:
        """Upload to Web3.Storage"""
        if not self._web3_storage_client:
            raise ValueError("Web3.Storage not initialized")
        
        # Read file content
        with open(file_path, "rb") as f:
            file_content = f.read()
        
        # Upload to Web3.Storage
        cid = await self._web3_storage_client.put(
            [file_content],
            name=original_filename,
        )
        
        # Construct URL
        url = f"{self.settings.IPFS_GATEWAY_URL}/{cid}/{original_filename}"
        
        return IPFSUploadResult(
            cid=cid,
            url=url,
            provider=StorageProvider.IPFS,
            file_size_bytes=file_size_bytes,
            original_filename=original_filename,
        )
    
    async def _upload_to_public_ipfs_gateway(
        self,
        file_path: Path,
        original_filename: str,
        file_size_bytes: int,
    ) -> IPFSUploadResult:
        """Upload to a public IPFS gateway (fallback)"""
        # This is a fallback method using HTTP API
        # In production, you'd want to use a dedicated IPFS node or service
        
        # For now, we'll use web3.storage's public API
        # This requires the token to be set
        if not self.settings.WEB3_STORAGE_TOKEN:
            raise ValueError("WEB3_STORAGE_TOKEN required for IPFS uploads")
        
        url = "https://api.web3.storage/upload"
        
        with open(file_path, "rb") as f:
            files = {"file": (original_filename, f)}
            headers = {"Authorization": f"Bearer {self.settings.WEB3_STORAGE_TOKEN}"}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=files, headers=headers) as response:
                    if response.status != 200:
                        text = await response.text()
                        raise ValueError(f"Upload failed: {response.status} - {text}")
                    
                    result = await response.json()
                    cid = result.get("cid")
                    
                    if not cid:
                        raise ValueError("No CID returned from upload")
                    
                    file_url = f"{self.settings.IPFS_GATEWAY_URL}/{cid}/{original_filename}"
                    
                    return IPFSUploadResult(
                        cid=cid,
                        url=file_url,
                        provider=StorageProvider.IPFS,
                        file_size_bytes=file_size_bytes,
                        original_filename=original_filename,
                    )
    
    async def download_file(
        self,
        cid: str,
        filename: Optional[str] = None,
    ) -> bytes:
        """
        Download a file from IPFS
        
        Args:
            cid: IPFS Content ID
            filename: Optional filename (for gateway URLs)
            
        Returns:
            File content as bytes
        """
        url = f"{self.settings.IPFS_GATEWAY_URL}/{cid}"
        if filename:
            url = f"{url}/{filename}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise ValueError(f"Download failed: {response.status}")
                return await response.read()
    
    async def get_file_info(
        self,
        cid: str,
    ) -> dict[str, Any]:
        """
        Get information about a file stored on IPFS
        
        Args:
            cid: IPFS Content ID
            
        Returns:
            File information
        """
        # This would typically query the IPFS node or gateway
        # For now, return basic info
        return {
            "cid": cid,
            "url": f"{self.settings.IPFS_GATEWAY_URL}/{cid}",
            "provider": StorageProvider.IPFS,
        }
    
    async def pin_file(
        self,
        cid: str,
        provider: StorageProvider = StorageProvider.IPFS,
    ) -> bool:
        """
        Pin a file to ensure it stays available
        
        Args:
            cid: IPFS Content ID
            provider: Provider to pin with
            
        Returns:
            Whether pinning was successful
        """
        # Web3.Storage automatically pins files uploaded through it
        if provider == StorageProvider.IPFS and self._web3_storage_client:
            # Files uploaded via web3.storage are automatically pinned
            return True
        
        # For other providers, you'd need to implement their pinning API
        # For example, Pinata has a pinning API
        if provider == StorageProvider.PINATA:
            if not self.settings.WEB3_STORAGE_TOKEN:
                raise ValueError("WEB3_STORAGE_TOKEN required for pinning")
            
            url = "https://api.pinata.cloud/pinning/pinByHash"
            headers = {
                "Authorization": f"Bearer {self.settings.WEB3_STORAGE_TOKEN}",
                "Content-Type": "application/json",
            }
            data = {"hashToPin": cid}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=data, headers=headers) as response:
                    return response.status == 200
        
        return False
    
    async def list_files(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """
        List files uploaded by the user
        
        Args:
            limit: Maximum number of files to return
            offset: Offset for pagination
            
        Returns:
            List of file information
        """
        # Web3.Storage provides a list API
        if not self.settings.WEB3_STORAGE_TOKEN:
            return []
        
        url = "https://api.web3.storage/uploads"
        headers = {"Authorization": f"Bearer {self.settings.WEB3_STORAGE_TOKEN}"}
        params = {"limit": limit, "offset": offset}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                if response.status != 200:
                    return []
                
                result = await response.json()
                return result.get("uploads", [])
    
    async def delete_file(
        self,
        cid: str,
        provider: StorageProvider = StorageProvider.IPFS,
    ) -> bool:
        """
        Delete a file from IPFS storage
        
        Note: IPFS is immutable, so this typically means unpinning
        
        Args:
            cid: IPFS Content ID
            provider: Provider to delete from
            
        Returns:
            Whether deletion was successful
        """
        # Note: IPFS content is immutable and cannot be truly deleted
        # This would unpins the content from the provider
        
        if provider == StorageProvider.PINATA:
            if not self.settings.WEB3_STORAGE_TOKEN:
                raise ValueError("WEB3_STORAGE_TOKEN required for deletion")
            
            url = f"https://api.pinata.cloud/pinning/unpin/{cid}"
            headers = {
                "Authorization": f"Bearer {self.settings.WEB3_STORAGE_TOKEN}",
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.delete(url, headers=headers) as response:
                    return response.status == 200
        
        return False
    
    def get_file_type_from_mime(self, mime_type: str) -> FileType:
        """Determine file type from MIME type"""
        if mime_type.startswith("audio/"):
            return FileType.AUDIO
        elif mime_type.startswith("image/"):
            return FileType.IMAGE
        elif mime_type.startswith("video/"):
            return FileType.VIDEO
        elif mime_type in [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ]:
            return FileType.DOCUMENT
        elif mime_type.startswith("text/"):
            return FileType.TEXT
        else:
            return FileType.OTHER
    
    def get_file_type_from_extension(self, filename: str) -> FileType:
        """Determine file type from filename extension"""
        ext = Path(filename).suffix.lower()
        
        audio_exts = [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"]
        image_exts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"]
        video_exts = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv"]
        doc_exts = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"]
        
        if ext in audio_exts:
            return FileType.AUDIO
        elif ext in image_exts:
            return FileType.IMAGE
        elif ext in video_exts:
            return FileType.VIDEO
        elif ext in doc_exts:
            return FileType.DOCUMENT
        elif ext == ".txt":
            return FileType.TEXT
        else:
            return FileType.OTHER


# Singleton instance
_ipfs_service: Optional[IPFSService] = None


async def get_ipfs_service() -> IPFSService:
    """Get the IPFS service singleton"""
    global _ipfs_service
    if _ipfs_service is None:
        _ipfs_service = IPFSService()
        await _ipfs_service.initialize()
    return _ipfs_service
