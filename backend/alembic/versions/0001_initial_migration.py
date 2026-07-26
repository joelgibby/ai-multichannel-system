"""
Initial database migration for AI Multichannel System

This migration creates all the core tables:
- users
- conversations
- messages
- file_storage
- sessions

Revision ID: 0001_initial_migration
Revises: 
Create Date: 2024-07-24 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = '0001_initial_migration'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all initial tables for the AI Multichannel System."""
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), primary_key=True, index=True, unique=True, nullable=False),
        sa.Column('email', sa.String(length=255), unique=True, nullable=True, index=True),
        sa.Column('phone_number', sa.String(length=20), unique=True, nullable=True, index=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.Column('full_name', sa.String(length=100), nullable=True),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('default_ai_model', sa.String(length=100), nullable=False, server_default='mistralai/mistral-7b-instruct'),
        sa.Column('preferred_voice_id', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create conversations table
    op.create_table(
        'conversations',
        sa.Column('id', sa.Uuid(), primary_key=True, index=True, unique=True, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('channel', sa.Enum('web', 'sms', 'voice', 'mobile', 'email', name='channeltype'), nullable=False, server_default='web', index=True),
        sa.Column('status', sa.Enum('active', 'archived', 'deleted', name='conversationstatus'), nullable=False, server_default='active', index=True),
        sa.Column('ai_model', sa.String(length=100), nullable=False, server_default='mistralai/mistral-7b-instruct'),
        sa.Column('temperature', sa.Float(), nullable=False, server_default='0.7'),
        sa.Column('max_tokens', sa.Integer(), nullable=False, server_default='4096'),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('context_window', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('external_id', sa.String(length=255), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('user_id', sa.Uuid(), nullable=True, index=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    )
    
    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.Uuid(), primary_key=True, index=True, unique=True, nullable=False),
        sa.Column('role', sa.Enum('user', 'assistant', 'system', name='messagerole'), nullable=False, index=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('message_type', sa.Enum('text', 'audio', 'image', 'video', 'file', 'command', name='messagetype'), nullable=False, server_default='text'),
        sa.Column('status', sa.Enum('pending', 'processing', 'completed', 'failed', name='messagestatus'), nullable=False, server_default='completed', index=True),
        sa.Column('metadata', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('ai_model', sa.String(length=100), nullable=True),
        sa.Column('tokens_used', sa.Integer(), nullable=True),
        sa.Column('latency_ms', sa.Float(), nullable=True),
        sa.Column('external_id', sa.String(length=255), nullable=True, index=True),
        sa.Column('file_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('conversation_id', sa.Uuid(), nullable=False, index=True),
        sa.Column('user_id', sa.Uuid(), nullable=True, index=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['file_id'], ['file_storage.id'], ondelete='SET NULL'),
    )
    
    # Create file_storage table
    op.create_table(
        'file_storage',
        sa.Column('id', sa.Uuid(), primary_key=True, index=True, unique=True, nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('stored_filename', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.Enum('audio', 'image', 'video', 'document', 'text', 'other', name='filetype'), nullable=False, server_default='other', index=True),
        sa.Column('mime_type', sa.String(length=100), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('provider', sa.Enum('s3', 'local', name='storageprovider'), nullable=False, server_default='s3', index=True),
        sa.Column('storage_path', sa.String(length=500), nullable=False),
        sa.Column('cid', sa.String(length=100), nullable=True, index=True),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('access_token', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('user_id', sa.Uuid(), nullable=True, index=True),
        sa.Column('conversation_id', sa.Uuid(), nullable=True, index=True),
        sa.Column('message_id', sa.Uuid(), nullable=True, index=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='SET NULL'),
    )
    
    # Create sessions table
    op.create_table(
        'sessions',
        sa.Column('id', sa.Uuid(), primary_key=True, index=True, unique=True, nullable=False),
        sa.Column('session_key', sa.String(length=255), nullable=False, unique=True, index=True),
        sa.Column('access_token', sa.String(length=500), nullable=False),
        sa.Column('refresh_token', sa.String(length=500), nullable=True),
        sa.Column('device_type', sa.String(length=50), nullable=True),
        sa.Column('device_id', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('country', sa.String(length=2), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_id', sa.Uuid(), nullable=False, index=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    # Create indexes for better query performance
    op.create_index(op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'])
    op.create_index(op.f('ix_messages_user_id'), 'messages', ['user_id'])
    op.create_index(op.f('ix_file_storage_user_id'), 'file_storage', ['user_id'])
    op.create_index(op.f('ix_file_storage_conversation_id'), 'file_storage', ['conversation_id'])
    op.create_index(op.f('ix_file_storage_message_id'), 'file_storage', ['message_id'])
    op.create_index(op.f('ix_sessions_user_id'), 'sessions', ['user_id'])


def downgrade() -> None:
    """Drop all tables created in the upgrade."""
    op.drop_table('sessions')
    op.drop_table('file_storage')
    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('users')
    
    # Drop enum types
    op.drop_index(op.f('ix_sessions_user_id'), table_name='sessions')
    op.drop_index(op.f('ix_file_storage_message_id'), table_name='file_storage')
    op.drop_index(op.f('ix_file_storage_conversation_id'), table_name='file_storage')
    op.drop_index(op.f('ix_file_storage_user_id'), table_name='file_storage')
    op.drop_index(op.f('ix_messages_user_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_conversation_id'), table_name='messages')
    
    # Drop enum types in the correct order (after tables that use them)
    sa.Enum(name='storageprovider').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='filetype').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='messagestatus').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='messagetype').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='messagerole').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='conversationstatus').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='channeltype').drop(op.get_bind(), checkfirst=False)
