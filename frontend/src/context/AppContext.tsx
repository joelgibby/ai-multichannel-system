// AI Multichannel System - App Context
// Global state management using React Context

import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';

import {
  AppState,
  ChatState,
  VoiceState,
  SMSState,
  FileState,
  SettingsState,
  Message,
  Conversation,
  User,
  ChannelType,
  AIModel,
} from '@/types';
import { api, setAuthToken, clearAuth, getSavedUser } from '@/services/api';
import { initSocket, disconnectSocket, cleanupSocket } from '@/services/socket';

// ============================================
// Action Types
// ============================================

type Action =
  // Chat actions
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'SET_CHAT_LOADING'; payload: boolean }
  | { type: 'SET_CHAT_STREAMING'; payload: boolean }
  | { type: 'SET_CHAT_ERROR'; payload: string | undefined }
  | { type: 'SET_CHAT_STREAM'; payload: string }
  | { type: 'SET_CONVERSATION'; payload: Conversation | undefined }
  
  // Voice actions
  | { type: 'SET_VOICE_RECORDING'; payload: boolean }
  | { type: 'SET_VOICE_PLAYING'; payload: boolean }
  | { type: 'SET_VOICE_TIME'; payload: number }
  | { type: 'SET_VOICE_BLOB'; payload: Blob | undefined }
  | { type: 'SET_VOICE_URL'; payload: string | undefined }
  | { type: 'SET_VOICE_TRANSCRIPTION'; payload: string | undefined }
  | { type: 'SET_VOICE_TRANSCRIBING'; payload: boolean }
  | { type: 'SET_VOICE_ERROR'; payload: string | undefined }
  
  // SMS actions
  | { type: 'SET_SMS_MESSAGES'; payload: any[] }
  | { type: 'ADD_SMS_MESSAGE'; payload: any }
  | { type: 'SET_SMS_SENDING'; payload: boolean }
  | { type: 'SET_SMS_PHONE'; payload: string }
  | { type: 'SET_SMS_ERROR'; payload: string | undefined }
  
  // File actions
  | { type: 'SET_FILES'; payload: any[] }
  | { type: 'ADD_FILE'; payload: any }
  | { type: 'REMOVE_FILE'; payload: string }
  | { type: 'SET_FILE_UPLOADING'; payload: boolean }
  | { type: 'SET_FILE_PROGRESS'; payload: number }
  | { type: 'SET_FILE_ERROR'; payload: string | undefined }
  
  // Settings actions
  | { type: 'SET_AI_MODEL'; payload: string }
  | { type: 'SET_TEMPERATURE'; payload: number }
  | { type: 'SET_MAX_TOKENS'; payload: number }
  | { type: 'SET_VOICE_ID'; payload: string }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' }
  | { type: 'SET_AVAILABLE_MODELS'; payload: AIModel[] }
  | { type: 'SET_SETTINGS_LOADING'; payload: boolean }
  
  // User actions
  | { type: 'SET_USER'; payload: User | undefined }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  
  // Connection actions
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: string | undefined }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: Conversation }
  | { type: 'REMOVE_CONVERSATION'; payload: string }
  | { type: 'RESET' };

// ============================================
// Initial State
// ============================================

const initialChatState: ChatState = {
  messages: [],
  isLoading: false,
  isStreaming: false,
  currentStream: '',
  conversation: undefined,
  error: undefined,
};

const initialVoiceState: VoiceState = {
  isRecording: false,
  isPlaying: false,
  recordingTime: 0,
  audioBlob: undefined,
  audioUrl: undefined,
  transcription: undefined,
  isTranscribing: false,
  error: undefined,
};

const initialSMSState: SMSState = {
  messages: [],
  isSending: false,
  phoneNumber: '',
  error: undefined,
};

const initialFileState: FileState = {
  files: [],
  isUploading: false,
  uploadProgress: 0,
  error: undefined,
};

const initialSettingsState: SettingsState = {
  aiModel: 'mistralai/mistral-7b-instruct',
  temperature: 0.7,
  maxTokens: 4096,
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  theme: 'system',
  availableModels: [],
  isLoading: false,
};

const initialState: AppState = {
  chat: initialChatState,
  voice: initialVoiceState,
  sms: initialSMSState,
  files: initialFileState,
  settings: initialSettingsState,
  user: undefined,
  isAuthenticated: false,
  isConnected: false,
  conversations: [],
  activeConversationId: undefined,
};

// ============================================
// Reducer
// ============================================

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    // Chat actions
    case 'SET_MESSAGES':
      return { ...state, chat: { ...state.chat, messages: action.payload } };
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        chat: { 
          ...state.chat, 
          messages: [...state.chat.messages, action.payload] 
        } 
      };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: state.chat.messages.map((msg) =>
            msg.id === action.payload.id ? { ...msg, ...action.payload.updates } : msg
          ),
        },
      };
    case 'SET_CHAT_LOADING':
      return { ...state, chat: { ...state.chat, isLoading: action.payload } };
    case 'SET_CHAT_STREAMING':
      return { ...state, chat: { ...state.chat, isStreaming: action.payload } };
    case 'SET_CHAT_ERROR':
      return { ...state, chat: { ...state.chat, error: action.payload } };
    case 'SET_CHAT_STREAM':
      return { ...state, chat: { ...state.chat, currentStream: action.payload } };
    case 'SET_CONVERSATION':
      return { ...state, chat: { ...state.chat, conversation: action.payload } };

    // Voice actions
    case 'SET_VOICE_RECORDING':
      return { ...state, voice: { ...state.voice, isRecording: action.payload } };
    case 'SET_VOICE_PLAYING':
      return { ...state, voice: { ...state.voice, isPlaying: action.payload } };
    case 'SET_VOICE_TIME':
      return { ...state, voice: { ...state.voice, recordingTime: action.payload } };
    case 'SET_VOICE_BLOB':
      return { ...state, voice: { ...state.voice, audioBlob: action.payload } };
    case 'SET_VOICE_URL':
      return { ...state, voice: { ...state.voice, audioUrl: action.payload } };
    case 'SET_VOICE_TRANSCRIPTION':
      return { ...state, voice: { ...state.voice, transcription: action.payload } };
    case 'SET_VOICE_TRANSCRIBING':
      return { ...state, voice: { ...state.voice, isTranscribing: action.payload } };
    case 'SET_VOICE_ERROR':
      return { ...state, voice: { ...state.voice, error: action.payload } };

    // SMS actions
    case 'SET_SMS_MESSAGES':
      return { ...state, sms: { ...state.sms, messages: action.payload } };
    case 'ADD_SMS_MESSAGE':
      return { 
        ...state, 
        sms: { 
          ...state.sms, 
          messages: [...state.sms.messages, action.payload] 
        } 
      };
    case 'SET_SMS_SENDING':
      return { ...state, sms: { ...state.sms, isSending: action.payload } };
    case 'SET_SMS_PHONE':
      return { ...state, sms: { ...state.sms, phoneNumber: action.payload } };
    case 'SET_SMS_ERROR':
      return { ...state, sms: { ...state.sms, error: action.payload } };

    // File actions
    case 'SET_FILES':
      return { ...state, files: { ...state.files, files: action.payload } };
    case 'ADD_FILE':
      return { 
        ...state, 
        files: { 
          ...state.files, 
          files: [...state.files.files, action.payload] 
        } 
      };
    case 'REMOVE_FILE':
      return {
        ...state,
        files: {
          ...state.files,
          files: state.files.files.filter((file: any) => file.id !== action.payload),
        },
      };
    case 'SET_FILE_UPLOADING':
      return { ...state, files: { ...state.files, isUploading: action.payload } };
    case 'SET_FILE_PROGRESS':
      return { ...state, files: { ...state.files, uploadProgress: action.payload } };
    case 'SET_FILE_ERROR':
      return { ...state, files: { ...state.files, error: action.payload } };

    // Settings actions
    case 'SET_AI_MODEL':
      return { ...state, settings: { ...state.settings, aiModel: action.payload } };
    case 'SET_TEMPERATURE':
      return { ...state, settings: { ...state.settings, temperature: action.payload } };
    case 'SET_MAX_TOKENS':
      return { ...state, settings: { ...state.settings, maxTokens: action.payload } };
    case 'SET_VOICE_ID':
      return { ...state, settings: { ...state.settings, voiceId: action.payload } };
    case 'SET_THEME':
      return { ...state, settings: { ...state.settings, theme: action.payload } };
    case 'SET_AVAILABLE_MODELS':
      return { ...state, settings: { ...state.settings, availableModels: action.payload } };
    case 'SET_SETTINGS_LOADING':
      return { ...state, settings: { ...state.settings, isLoading: action.payload } };

    // User actions
    case 'SET_USER':
      return { ...state, user: action.payload, isAuthenticated: !!action.payload };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };

    // Connection actions
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversationId: action.payload };
    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        activeConversationId: action.payload.id,
      };
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === action.payload.id ? action.payload : conv
        ),
      };
    case 'REMOVE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter((conv) => conv.id !== action.payload),
        activeConversationId:
          state.activeConversationId === action.payload
            ? undefined
            : state.activeConversationId,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
};

// ============================================
// Context
// ============================================

interface AppContextType extends AppState {
  // Chat actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setChatLoading: (loading: boolean) => void;
  setChatStreaming: (streaming: boolean) => void;
  setChatError: (error: string | undefined) => void;
  setChatStream: (stream: string) => void;
  setConversation: (conversation: Conversation | undefined) => void;

  // Voice actions
  setVoiceRecording: (recording: boolean) => void;
  setVoicePlaying: (playing: boolean) => void;
  setVoiceTime: (time: number) => void;
  setVoiceBlob: (blob: Blob | undefined) => void;
  setVoiceUrl: (url: string | undefined) => void;
  setVoiceTranscription: (text: string | undefined) => void;
  setVoiceTranscribing: (transcribing: boolean) => void;
  setVoiceError: (error: string | undefined) => void;

  // SMS actions
  setSMSMessages: (messages: any[]) => void;
  addSMSMessage: (message: any) => void;
  setSMSSending: (sending: boolean) => void;
  setSMSPhone: (phone: string) => void;
  setSMSError: (error: string | undefined) => void;

  // File actions
  setFiles: (files: any[]) => void;
  addFile: (file: any) => void;
  removeFile: (id: string) => void;
  setFileUploading: (uploading: boolean) => void;
  setFileProgress: (progress: number) => void;
  setFileError: (error: string | undefined) => void;

  // Settings actions
  setAIModel: (model: string) => void;
  setTemperature: (temperature: number) => void;
  setMaxTokens: (maxTokens: number) => void;
  setVoiceId: (voiceId: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setAvailableModels: (models: AIModel[]) => void;
  setSettingsLoading: (loading: boolean) => void;

  // User actions
  setUser: (user: User | undefined) => void;
  setAuthenticated: (authenticated: boolean) => void;

  // Connection actions
  setConnected: (connected: boolean) => void;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | undefined) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  reset: () => void;

  // API actions
  fetchAIModels: () => Promise<void>;
  createNewConversation: (channel?: ChannelType) => Promise<Conversation>;
  sendChatMessage: (content: string, conversationId?: string) => Promise<void>;
  sendVoiceMessage: (audioBlob: Blob) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;

  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();

  // Initialize socket on mount
  useEffect(() => {
    // Initialize socket connection
    initSocket();
    
    // Load saved user
    const savedUser = getSavedUser();
    if (savedUser) {
      dispatch({ type: 'SET_USER', payload: savedUser });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
      setAuthToken(localStorage.getItem('access_token') || '');
    }
    
    // Load theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      dispatch({ type: 'SET_THEME', payload: savedTheme });
    }
    
    // Load AI models
    fetchAIModels();
    
    // Cleanup on unmount
    return () => {
      disconnectSocket();
      cleanupSocket();
    };
  }, []);

  // Load conversations when authenticated
  useEffect(() => {
    if (state.isAuthenticated) {
      loadConversations();
    }
  }, [state.isAuthenticated]);

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    
    if (state.settings.theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (state.settings.theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      // System theme
      root.classList.remove('dark', 'light');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      }
    }
    
    // Save theme preference
    localStorage.setItem('theme', state.settings.theme);
  }, [state.settings.theme]);

  // ============================================
  // Dispatch Functions
  // ============================================

  // Chat
  const setMessages = useCallback((messages: Message[]) => {
    dispatch({ type: 'SET_MESSAGES', payload: messages });
  }, []);

  const addMessage = useCallback((message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { id, updates } });
  }, []);

  const setChatLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_CHAT_LOADING', payload: loading });
  }, []);

  const setChatStreaming = useCallback((streaming: boolean) => {
    dispatch({ type: 'SET_CHAT_STREAMING', payload: streaming });
  }, []);

  const setChatError = useCallback((error: string | undefined) => {
    dispatch({ type: 'SET_CHAT_ERROR', payload: error });
  }, []);

  const setChatStream = useCallback((stream: string) => {
    dispatch({ type: 'SET_CHAT_STREAM', payload: stream });
  }, []);

  const setConversation = useCallback((conversation: Conversation | undefined) => {
    dispatch({ type: 'SET_CONVERSATION', payload: conversation });
  }, []);

  // Voice
  const setVoiceRecording = useCallback((recording: boolean) => {
    dispatch({ type: 'SET_VOICE_RECORDING', payload: recording });
  }, []);

  const setVoicePlaying = useCallback((playing: boolean) => {
    dispatch({ type: 'SET_VOICE_PLAYING', payload: playing });
  }, []);

  const setVoiceTime = useCallback((time: number) => {
    dispatch({ type: 'SET_VOICE_TIME', payload: time });
  }, []);

  const setVoiceBlob = useCallback((blob: Blob | undefined) => {
    dispatch({ type: 'SET_VOICE_BLOB', payload: blob });
  }, []);

  const setVoiceUrl = useCallback((url: string | undefined) => {
    dispatch({ type: 'SET_VOICE_URL', payload: url });
  }, []);

  const setVoiceTranscription = useCallback((text: string | undefined) => {
    dispatch({ type: 'SET_VOICE_TRANSCRIPTION', payload: text });
  }, []);

  const setVoiceTranscribing = useCallback((transcribing: boolean) => {
    dispatch({ type: 'SET_VOICE_TRANSCRIBING', payload: transcribing });
  }, []);

  const setVoiceError = useCallback((error: string | undefined) => {
    dispatch({ type: 'SET_VOICE_ERROR', payload: error });
  }, []);

  // SMS
  const setSMSMessages = useCallback((messages: any[]) => {
    dispatch({ type: 'SET_SMS_MESSAGES', payload: messages });
  }, []);

  const addSMSMessage = useCallback((message: any) => {
    dispatch({ type: 'ADD_SMS_MESSAGE', payload: message });
  }, []);

  const setSMSSending = useCallback((sending: boolean) => {
    dispatch({ type: 'SET_SMS_SENDING', payload: sending });
  }, []);

  const setSMSPhone = useCallback((phone: string) => {
    dispatch({ type: 'SET_SMS_PHONE', payload: phone });
  }, []);

  const setSMSError = useCallback((error: string | undefined) => {
    dispatch({ type: 'SET_SMS_ERROR', payload: error });
  }, []);

  // Files
  const setFiles = useCallback((files: any[]) => {
    dispatch({ type: 'SET_FILES', payload: files });
  }, []);

  const addFile = useCallback((file: any) => {
    dispatch({ type: 'ADD_FILE', payload: file });
  }, []);

  const removeFile = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FILE', payload: id });
  }, []);

  const setFileUploading = useCallback((uploading: boolean) => {
    dispatch({ type: 'SET_FILE_UPLOADING', payload: uploading });
  }, []);

  const setFileProgress = useCallback((progress: number) => {
    dispatch({ type: 'SET_FILE_PROGRESS', payload: progress });
  }, []);

  const setFileError = useCallback((error: string | undefined) => {
    dispatch({ type: 'SET_FILE_ERROR', payload: error });
  }, []);

  // Settings
  const setAIModel = useCallback((model: string) => {
    dispatch({ type: 'SET_AI_MODEL', payload: model });
  }, []);

  const setTemperature = useCallback((temperature: number) => {
    dispatch({ type: 'SET_TEMPERATURE', payload: temperature });
  }, []);

  const setMaxTokens = useCallback((maxTokens: number) => {
    dispatch({ type: 'SET_MAX_TOKENS', payload: maxTokens });
  }, []);

  const setVoiceId = useCallback((voiceId: string) => {
    dispatch({ type: 'SET_VOICE_ID', payload: voiceId });
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const setAvailableModels = useCallback((models: AIModel[]) => {
    dispatch({ type: 'SET_AVAILABLE_MODELS', payload: models });
  }, []);

  const setSettingsLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_SETTINGS_LOADING', payload: loading });
  }, []);

  // User
  const setUser = useCallback((user: User | undefined) => {
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const setAuthenticated = useCallback((authenticated: boolean) => {
    dispatch({ type: 'SET_AUTHENTICATED', payload: authenticated });
  }, []);

  // Connection
  const setConnected = useCallback((connected: boolean) => {
    dispatch({ type: 'SET_CONNECTED', payload: connected });
  }, []);

  const setConversations = useCallback((conversations: Conversation[]) => {
    dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
  }, []);

  const setActiveConversation = useCallback((id: string | undefined) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: id });
  }, []);

  const addConversation = useCallback((conversation: Conversation) => {
    dispatch({ type: 'ADD_CONVERSATION', payload: conversation });
  }, []);

  const updateConversation = useCallback((conversation: Conversation) => {
    dispatch({ type: 'UPDATE_CONVERSATION', payload: conversation });
  }, []);

  const removeConversation = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_CONVERSATION', payload: id });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // ============================================
  // API Actions
  // ============================================

  const fetchAIModels = async () => {
    try {
      setSettingsLoading(true);
      const models = await api.listAIModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to fetch AI models:', error);
      toast.error('Failed to load AI models');
    } finally {
      setSettingsLoading(false);
    }
  };

  const createNewConversation = async (channel: ChannelType = 'web') => {
    try {
      const conversation = await api.createConversation({
        channel,
        ai_model: state.settings.aiModel,
        temperature: state.settings.temperature,
        max_tokens: state.settings.maxTokens,
      });
      
      addConversation(conversation);
      setActiveConversation(conversation.id);
      setConversation(conversation);
      setMessages([]);
      
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast.error('Failed to create conversation');
      throw error;
    }
  };

  const sendChatMessage = async (content: string, conversationId?: string) => {
    try {
      const id = conversationId || state.activeConversationId;
      if (!id) {
        throw new Error('No active conversation');
      }

      setChatLoading(true);
      setChatError(undefined);

      // Add user message immediately for better UX
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        message_type: 'text',
        status: 'completed',
        metadata: {},
        conversation_id: id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addMessage(userMessage);

      // Send to API
      const response = await api.chatWithAI(
        [
          ...state.chat.messages.filter((m) => m.role !== 'system'),
          { role: 'user', content },
        ],
        {
          model: state.settings.aiModel,
          temperature: state.settings.temperature,
          max_tokens: state.settings.maxTokens,
        }
      );

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        message_type: 'text',
        status: 'completed',
        metadata: {
          model: response.model,
          finish_reason: response.finish_reason,
          tokens_used: response.usage.total_tokens,
          latency_ms: response.latency_ms,
        },
        ai_model: response.model,
        tokens_used: response.usage.total_tokens,
        latency_ms: response.latency_ms,
        conversation_id: id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addMessage(assistantMessage);

      // Update conversation in backend
      await api.addMessageToConversation(id, {
        role: 'user',
        content,
        message_type: 'text',
      });
      await api.addMessageToConversation(id, {
        role: 'assistant',
        content: response.content,
        message_type: 'text',
        ai_model: response.model,
      });

    } catch (error) {
      console.error('Failed to send message:', error);
      setChatError('Failed to send message');
      toast.error('Failed to send message');
    } finally {
      setChatLoading(false);
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
    try {
      const id = state.activeConversationId;
      if (!id) {
        throw new Error('No active conversation');
      }

      setVoiceTranscribing(true);
      setVoiceError(undefined);

      // Upload audio to IPFS
      const uploadResult = await api.uploadToIPFS(
        new File([audioBlob], 'voice-message.wav', { type: 'audio/wav' }),
        (progress) => setFileProgress(progress)
      );

      // Send to AI for transcription
      const transcription = await api.speechToText({
        audio_url: uploadResult.url,
        model: 'openai/whisper-1',
      });

      setVoiceTranscription(transcription.text);

      // Send transcribed text as message
      await sendChatMessage(transcription.text, id);

    } catch (error) {
      console.error('Failed to send voice message:', error);
      setVoiceError('Failed to send voice message');
      toast.error('Failed to send voice message');
    } finally {
      setVoiceTranscribing(false);
    }
  };

  const uploadFile = async (file: File) => {
    try {
      setFileUploading(true);
      setFileError(undefined);

      const result = await api.uploadToIPFS(file, (progress) => {
        setFileProgress(progress);
      });

      addFile({
        id: result.cid,
        original_filename: file.name,
        stored_filename: result.original_filename,
        file_type: getFileTypeFromName(file.name),
        mime_type: file.type,
        file_size_bytes: file.size,
        provider: result.provider,
        storage_path: result.cid,
        cid: result.cid,
        url: result.url,
        is_public: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      toast.success('File uploaded successfully');

    } catch (error) {
      console.error('Failed to upload file:', error);
      setFileError('Failed to upload file');
      toast.error('Failed to upload file');
    } finally {
      setFileUploading(false);
      setFileProgress(0);
    }
  };

  const loadConversations = async () => {
    try {
      const conversations = await api.listConversations();
      setConversations(conversations);
      
      // Set first conversation as active if none selected
      if (conversations.length > 0 && !state.activeConversationId) {
        setActiveConversation(conversations[0].id);
        await loadConversation(conversations[0].id);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      setChatLoading(true);
      const conversation = await api.getConversation(id);
      const messages = await api.getConversationMessages(id);
      
      setConversation(conversation);
      setMessages(messages);
      setActiveConversation(id);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast.error('Failed to load conversation');
    } finally {
      setChatLoading(false);
    }
  };

  const switchConversation = (id: string) => {
    setActiveConversation(id);
    loadConversation(id);
  };

  const deleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      removeConversation(id);
      
      // Switch to another conversation or create new
      if (state.conversations.length > 1) {
        const nextConversation = state.conversations.find((c) => c.id !== id);
        if (nextConversation) {
          switchConversation(nextConversation.id);
        }
      } else {
        // Create new conversation
        createNewConversation();
      }
      
      toast.success('Conversation deleted');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };

  // ============================================
  // Auth Actions
  // ============================================

  const login = async (email: string, password: string) => {
    try {
      const token = await api.login(email, password);
      setAuthToken(token.access_token);
      setUser(await api.getCurrentUser());
      setAuthenticated(true);
      
      if (token.refresh_token) {
        localStorage.setItem('refresh_token', token.refresh_token);
      }
      
      toast.success('Logged in successfully');
      router.push('/chat');
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Login failed. Please check your credentials.');
      throw error;
    }
  };

  const register = async (userData: any) => {
    try {
      const token = await api.register(userData);
      setAuthToken(token.access_token);
      setUser(await api.getCurrentUser());
      setAuthenticated(true);
      
      if (token.refresh_token) {
        localStorage.setItem('refresh_token', token.refresh_token);
      }
      
      toast.success('Registration successful');
      router.push('/chat');
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error('Registration failed. Please try again.');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      clearAuth();
      reset();
      router.push('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      clearAuth();
      reset();
      router.push('/login');
    }
  };

  const checkAuth = async () => {
    try {
      const user = await api.getCurrentUser();
      setUser(user);
      setAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      clearAuth();
      setAuthenticated(false);
      setUser(undefined);
    }
  };

  // Helper function
  const getFileTypeFromName = (filename: string): any => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'];
    const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
    
    if (audioExts.includes(ext || '')) return 'audio';
    if (imageExts.includes(ext || '')) return 'image';
    if (videoExts.includes(ext || '')) return 'video';
    if (docExts.includes(ext || '')) return 'document';
    if (ext === 'txt') return 'text';
    return 'other';
  };

  // Context value
  const value: AppContextType = {
    // State
    ...state,

    // Chat actions
    setMessages,
    addMessage,
    updateMessage,
    setChatLoading,
    setChatStreaming,
    setChatError,
    setChatStream,
    setConversation,

    // Voice actions
    setVoiceRecording,
    setVoicePlaying,
    setVoiceTime,
    setVoiceBlob,
    setVoiceUrl,
    setVoiceTranscription,
    setVoiceTranscribing,
    setVoiceError,

    // SMS actions
    setSMSMessages,
    addSMSMessage,
    setSMSSending,
    setSMSPhone,
    setSMSError,

    // File actions
    setFiles,
    addFile,
    removeFile,
    setFileUploading,
    setFileProgress,
    setFileError,

    // Settings actions
    setAIModel,
    setTemperature,
    setMaxTokens,
    setVoiceId,
    setTheme,
    setAvailableModels,
    setSettingsLoading,

    // User actions
    setUser,
    setAuthenticated,

    // Connection actions
    setConnected,
    setConversations,
    setActiveConversation,
    addConversation,
    updateConversation,
    removeConversation,
    reset,

    // API actions
    fetchAIModels,
    createNewConversation,
    sendChatMessage,
    sendVoiceMessage,
    uploadFile,
    loadConversations,
    loadConversation,
    switchConversation,
    deleteConversation,

    // Auth actions
    login,
    register,
    logout,
    checkAuth,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// ============================================
// Hook
// ============================================

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
