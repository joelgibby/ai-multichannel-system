// AI Multichannel System - TypeScript Types

// ============================================
// API Response Types
// ============================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    type: string;
    detail: string;
    status_code: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// ============================================
// AI Types
// ============================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  model: string;
  created: number;
  content: string;
  role: string;
  finish_reason: string;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  latency_ms: number;
}

export interface AIModel {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
  provider: string;
  tags: string[];
}

// ============================================
// IPFS Types
// ============================================

export type StorageProvider = 'ipfs' | 's3' | 'local' | 'filebase' | 'pinata';

export type FileType = 'audio' | 'image' | 'video' | 'document' | 'text' | 'other';

export interface IPFSUploadResult {
  cid: string;
  url: string;
  provider: StorageProvider;
  file_size_bytes: number;
  original_filename: string;
}

export interface FileStorage {
  id: string;
  original_filename: string;
  stored_filename: string;
  file_type: FileType;
  mime_type?: string;
  file_size_bytes: number;
  provider: StorageProvider;
  storage_path: string;
  cid?: string;
  url?: string;
  is_public: boolean;
  user_id?: string;
  conversation_id?: string;
  message_id?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Conversation Types
// ============================================

export type ChannelType = 'web' | 'sms' | 'voice' | 'mobile' | 'email';
export type ConversationStatus = 'active' | 'archived' | 'deleted';

export interface Conversation {
  id: string;
  title?: string;
  channel: ChannelType;
  status: ConversationStatus;
  ai_model: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
  context_window: any[];
  external_id?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationCreate {
  title?: string;
  channel?: ChannelType;
  ai_model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  external_id?: string;
}

// ============================================
// Message Types
// ============================================

export type MessageType = 'text' | 'audio' | 'image' | 'video' | 'file' | 'command';
export type MessageStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Message {
  id: string;
  role: MessageRole;
  content?: string;
  message_type: MessageType;
  status: MessageStatus;
  metadata: Record<string, any>;
  ai_model?: string;
  tokens_used?: number;
  latency_ms?: number;
  external_id?: string;
  file_id?: string;
  conversation_id: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageCreate {
  role: MessageRole;
  content?: string;
  message_type?: MessageType;
  metadata?: Record<string, any>;
  ai_model?: string;
}

// ============================================
// SMS Types
// ============================================

export interface SMSMessage {
  body: string;
  to: string;
  from?: string;
  media_urls?: string[];
}

export interface SMSResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  num_media: number;
}

export interface IncomingSMS {
  message_sid: string;
  from: string;
  to: string;
  body: string;
  num_media: number;
  media_urls: string[];
  profile_name?: string;
}

// ============================================
// Voice Types
// ============================================

export interface VoiceCall {
  call_sid: string;
  from: string;
  to: string;
  status: string;
  direction: string;
}

export interface VoiceRequest {
  text: string;
  voice_id?: string;
  language?: string;
  speed?: number;
}

export interface VoiceResponse {
  audio_url?: string;
  audio_bytes?: number[];
  duration_seconds?: number;
}

export interface STTRequest {
  audio_url?: string;
  audio_bytes?: number[];
  language?: string;
  model?: string;
}

export interface STTResponse {
  text: string;
  confidence?: number;
  language?: string;
  duration_seconds?: number;
}

// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  email?: string;
  phone_number?: string;
  full_name?: string;
  avatar_url?: string;
  default_ai_model: string;
  preferred_voice_id?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  email?: string;
  phone_number?: string;
  full_name?: string;
  avatar_url?: string;
  password?: string;
  default_ai_model?: string;
  preferred_voice_id?: string;
}

// ============================================
// Auth Types
// ============================================

export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface TokenData {
  user_id?: string;
  email?: string;
  phone_number?: string;
  session_id?: string;
}

export interface Session {
  id: string;
  session_key: string;
  access_token: string;
  refresh_token?: string;
  device_type?: string;
  device_id?: string;
  ip_address?: string;
  user_agent?: string;
  country?: string;
  city?: string;
  is_active: boolean;
  is_revoked: boolean;
  user_id: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
}

// ============================================
// WebSocket / Socket.IO Types
// ============================================

export type SocketEvent = 
  | 'connect'
  | 'disconnect'
  | 'connection'
  | 'message'
  | 'stream'
  | 'transcription'
  | 'voice:start'
  | 'voice:stop'
  | 'voice:data'
  | 'sms:received'
  | 'sms:sent'
  | 'error';

export interface SocketMessage {
  event: SocketEvent;
  data: any;
  timestamp: number;
}

export interface StreamChunk {
  chunk: string;
  conversation_id?: string;
  message_id?: string;
}

// ============================================
// UI State Types
// ============================================

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  currentStream: string;
  conversation?: Conversation;
  error?: string;
}

export interface VoiceState {
  isRecording: boolean;
  isPlaying: boolean;
  recordingTime: number;
  audioBlob?: Blob;
  audioUrl?: string;
  transcription?: string;
  isTranscribing: boolean;
  error?: string;
}

export interface SMSState {
  messages: IncomingSMS[];
  isSending: boolean;
  phoneNumber: string;
  error?: string;
}

export interface FileState {
  files: FileStorage[];
  isUploading: boolean;
  uploadProgress: number;
  error?: string;
}

export interface SettingsState {
  aiModel: string;
  temperature: number;
  maxTokens: number;
  voiceId: string;
  theme: 'light' | 'dark' | 'system';
  availableModels: AIModel[];
  isLoading: boolean;
}

// ============================================
// App State Types
// ============================================

export interface AppState {
  chat: ChatState;
  voice: VoiceState;
  sms: SMSState;
  files: FileState;
  settings: SettingsState;
  user?: User;
  isAuthenticated: boolean;
  isConnected: boolean;
  conversations: Conversation[];
  activeConversationId?: string;
}

// ============================================
// Component Props Types
// ============================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  label?: string;
  error?: string;
}

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
}

export interface MessageBubbleProps {
  message: Message;
  onRetry?: () => void;
  onDelete?: () => void;
}

export interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

export interface IPFSFileProps {
  file: FileStorage;
  onDownload: () => void;
  onDelete: () => void;
}

// ============================================
// Utility Types
// ============================================

export type ChannelConfig = {
  id: ChannelType;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  enabled: boolean;
};

export interface VoiceSettings {
  voiceId: string;
  language?: string;
  speed: number;
  model?: string;
}

export interface RecordingOptions {
  mimeType: string;
  sampleRate: number;
  bitsPerSecond: number;
}

export interface PlaybackOptions {
  volume: number;
  playbackRate: number;
}
