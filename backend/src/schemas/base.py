"""
Base schemas for the application
"""
from pydantic import BaseModel as PydanticBaseModel, ConfigDict


class BaseModel(PydanticBaseModel):
    """Base model with common configuration"""
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={
            # Custom JSON encoders for special types
        },
    )


class BaseSchema(BaseModel):
    """Base schema for all input/output schemas"""
    pass
