"""
Response schemas for API responses
"""
from typing import Any, Generic, Optional, TypeVar

from pydantic import Field

from .base import BaseSchema

T = TypeVar("T")


class APIResponse(BaseSchema, Generic[T]):
    """Generic API response wrapper"""
    success: bool = Field(..., description="Whether the request was successful")
    data: Optional[T] = Field(None, description="Response data")
    message: Optional[str] = Field(None, description="Response message")
    error: Optional[dict[str, Any]] = Field(None, description="Error details")


class SuccessResponse(APIResponse[T]):
    """Successful response"""
    success: bool = True


class ErrorResponse(APIResponse[None]):
    """Error response"""
    success: bool = False
    error: dict[str, Any] = Field(..., description="Error details")
    
    @classmethod
    def from_exception(cls, error: Exception, status_code: int = 400) -> "ErrorResponse":
        """Create error response from exception"""
        return cls(
            message=str(error),
            error={
                "type": type(error).__name__,
                "detail": str(error),
                "status_code": status_code,
            },
        )


class PaginatedResponse(BaseSchema, Generic[T]):
    """Paginated response with metadata"""
    items: list[T] = Field(default_factory=list, description="List of items")
    total: int = Field(0, description="Total number of items")
    page: int = Field(1, description="Current page number")
    page_size: int = Field(20, description="Number of items per page")
    total_pages: int = Field(0, description="Total number of pages")
    has_next: bool = Field(False, description="Whether there is a next page")
    has_previous: bool = Field(False, description="Whether there is a previous page")
    
    @classmethod
    def from_query(
        cls,
        items: list[T],
        total: int,
        page: int = 1,
        page_size: int = 20,
    ) -> "PaginatedResponse[T]":
        """Create paginated response from query results"""
        total_pages = (total + page_size - 1) // page_size
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
