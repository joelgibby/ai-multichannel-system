// AI Multichannel System - API Service
// Centralized API client for all backend communications

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

import {
  AIModel,
  APIResponse,
  ChatMessage,
  ChatResponse,
  Conversation,
  ConversationCreate,
  FileStorage,
  IncomingSMS,
  FileUploadResult,
  Message,
  MessageCreate,
  PaginatedResponse,
  SMSMessage,
  SMSResponse,
  STTRequest,
  STTResponse,
  Token,
  User,
  UserCreate,
  VoiceCall,
  VoiceRequest,
  VoiceResponse,
} from '@/types';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<APIResponse<any>>) => {
    // Handle errors globally
    const data = error.response?.data as { detail?: unknown; error?: { detail?: string }; message?: string } | undefined;
    const fastapiDetail = data?.detail;
    const errorMessage = Array.isArray(fastapiDetail)
      ? fastapiDetail.map((item: { msg?: string; loc?: unknown[] }) => item.msg || JSON.stringify(item)).join('; ')
      : (typeof fastapiDetail === 'string' ? fastapiDetail : undefined)
        || data?.error?.detail
        || data?.message
        || error.message
        || 'An unexpected error occurred';
    
    // Don't show toast for cancelled requests
    if (error.code !== 'ECONNABORTED') {
      // Only show toast for non-401 errors (auth errors are handled separately)
      if (error.response?.status !== 401) {
        toast.error(errorMessage);
      }
    }
    
    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: unknown; error?: { detail?: string }; message?: string } | undefined;
    const detail = data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item: { msg?: string }) => item.msg || JSON.stringify(item)).join('; ');
    }
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    return data?.error?.detail || data?.message || error.message || 'Request failed';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

// Helper function to handle API responses
export const handleResponse = async <T>(
  promise: Promise<AxiosResponse<APIResponse<T>>>
): Promise<T> => {
  try {
    const response = await promise;
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Request failed');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
};

// ============================================
// Health & Status Endpoints
// ============================================

export const healthCheck = async (): Promise<{ status: string; version: string }> => {
  return handleResponse(api.get<{ status: string; version: string }>('/health'));
};

// ============================================
// AI Endpoints
// ============================================

export const chatWithAI = async (
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  } = {}
): Promise<ChatResponse> => {
  return handleResponse(
    api.post<APIResponse<ChatResponse>>('/api/ai/chat', {
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content || '',
      })),
      ...options,
    })
  );
};

export const streamChatWithAI = async (
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
): Promise<Response> => {
  const response = await fetch(`${API_BASE_URL}/api/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
    },
    body: JSON.stringify({
      messages,
      ...options,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Stream request failed');
  }
  
  return response;
};

export const listAIModels = async (): Promise<AIModel[]> => {
  return handleResponse(api.get<AIModel[]>('/api/ai/models'));
};

// ============================================
// Object Storage Endpoints
// ============================================

export const uploadToStorage = async (
  file: File,
  onUploadProgress?: (progress: number) => void
): Promise<FileUploadResult> => {
  const formData = new FormData();
  formData.append('file', file);

  return handleResponse(
    api.post<FileUploadResult>('/api/storage/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onUploadProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(progress);
        }
      },
    })
  );
};

export const downloadFromStorage = async (key: string): Promise<Blob> => {
  const response = await api.get(`/api/storage/${key}`, {
    responseType: 'blob',
  });
  return response.data;
};

// ============================================
// SMS Endpoints
// ============================================

export const sendSMS = async (sms: SMSMessage): Promise<SMSResponse> => {
  return handleResponse(api.post<SMSResponse>('/api/sms/send', sms));
};

// ============================================
// Voice Endpoints
// ============================================

export const makeVoiceCall = async (
  to: string,
  twimlUrl?: string,
  twiml?: string
): Promise<VoiceCall> => {
  return handleResponse(
    api.post<VoiceCall>('/api/voice/call', {
      to,
      twiml_url: twimlUrl,
      twiml,
    })
  );
};

export const textToSpeech = async (request: VoiceRequest): Promise<VoiceResponse> => {
  return handleResponse(api.post<VoiceResponse>('/api/voice/tts', request));
};

export const speechToText = async (request: STTRequest): Promise<STTResponse> => {
  return handleResponse(api.post<STTResponse>('/api/voice/stt', request));
};

// ============================================
// Conversation Endpoints
// ============================================

export const createConversation = async (
  conversation: ConversationCreate
): Promise<Conversation> => {
  return handleResponse(
    api.post<Conversation>('/api/conversations', conversation)
  );
};

export const getConversation = async (id: string): Promise<Conversation> => {
  return handleResponse(api.get<Conversation>(`/api/conversations/${id}`));
};

export const listConversations = async (
  params: {
    user_id?: string;
    channel?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Conversation[]> => {
  return handleResponse(
    api.get<Conversation[]>('/api/conversations', { params })
  );
};

export const updateConversation = async (
  id: string,
  data: Partial<ConversationCreate>
): Promise<Conversation> => {
  return handleResponse(
    api.put<Conversation>(`/api/conversations/${id}`, data)
  );
};

export const deleteConversation = async (id: string): Promise<boolean> => {
  return handleResponse(api.delete<boolean>(`/api/conversations/${id}`));
};

export const addMessageToConversation = async (
  conversationId: string,
  message: MessageCreate
): Promise<Message> => {
  return handleResponse(
    api.post<Message>(`/api/conversations/${conversationId}/messages`, message)
  );
};

export const getConversationMessages = async (
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Message[]> => {
  return handleResponse(
    api.get<Message[]>(`/api/conversations/${conversationId}/messages`, {
      params: { limit, offset },
    })
  );
};

// ============================================
// User Endpoints
// ============================================

export const createUser = async (user: UserCreate): Promise<User> => {
  return handleResponse(api.post<User>('/api/users', user));
};

export const getUser = async (id: string): Promise<User> => {
  return handleResponse(api.get<User>(`/api/users/${id}`));
};

export const updateUser = async (id: string, data: Partial<UserCreate>): Promise<User> => {
  return handleResponse(api.put<User>(`/api/users/${id}`, data));
};

// ============================================
// Auth Endpoints
// ============================================

export const login = async (email: string, password: string): Promise<Token> => {
  return handleResponse(
    api.post<Token>('/api/auth/login', { email, password })
  );
};

export const register = async (user: UserCreate): Promise<Token> => {
  return handleResponse(api.post<Token>('/api/auth/register', user));
};

export const refreshToken = async (refreshToken: string): Promise<Token> => {
  return handleResponse(
    api.post<Token>('/api/auth/refresh', { refresh_token: refreshToken })
  );
};

export const logout = async (): Promise<boolean> => {
  return handleResponse(api.post<boolean>('/api/auth/logout'));
};

export const getCurrentUser = async (): Promise<User> => {
  return handleResponse(api.get<User>('/api/auth/me'));
};

// ============================================
// File Storage Endpoints
// ============================================

export const listFiles = async (
  params: {
    user_id?: string;
    conversation_id?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<FileStorage[]> => {
  return handleResponse(
    api.get<FileStorage[]>('/api/files', { params })
  );
};

export const deleteFile = async (id: string): Promise<boolean> => {
  return handleResponse(api.delete<boolean>(`/api/files/${id}`));
};

// ============================================
// Utility Functions
// ============================================

export const setAuthToken = (token: string) => {
  if (token) {
    localStorage.setItem('access_token', token);
    api.defaults.headers.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem('access_token');
    delete api.defaults.headers.Authorization;
  }
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

export const clearAuth = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  delete api.defaults.headers.Authorization;
};

export const saveUser = (user: User) => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const getSavedUser = (): User | null => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const saveRefreshToken = (token: string) => {
  localStorage.setItem('refresh_token', token);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refresh_token');
};

// Export the api instance for direct use if needed
export { api, API_BASE_URL };

export default {
  // Health
  healthCheck,
  
  // AI
  chatWithAI,
  streamChatWithAI,
  listAIModels,
  
  // Storage
  uploadToStorage,
  downloadFromStorage,
  
  // SMS
  sendSMS,
  
  // Voice
  makeVoiceCall,
  textToSpeech,
  speechToText,
  
  // Conversations
  createConversation,
  getConversation,
  listConversations,
  updateConversation,
  deleteConversation,
  addMessageToConversation,
  getConversationMessages,
  
  // Users
  createUser,
  getUser,
  updateUser,
  
  // Auth
  login,
  register,
  refreshToken,
  logout,
  getCurrentUser,
  setAuthToken,
  getAuthToken,
  clearAuth,
  saveUser,
  getSavedUser,
  saveRefreshToken,
  getRefreshToken,
  
  // Files
  listFiles,
  deleteFile,
};
