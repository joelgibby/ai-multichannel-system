// AI Multichannel System - Socket.IO Service
// Real-time communication with the backend

import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

import {
  Message,
  SocketEvent,
  SocketMessage,
  StreamChunk,
} from '@/types';

// Socket.IO Configuration
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const SOCKET_OPTIONS = {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: false,
  transports: ['websocket', 'polling'],
};

// Socket state
let socket: Socket | null = null;
let isConnected = false;
let connectionListeners: ((connected: boolean) => void)[] = [];
let messageListeners: ((message: Message) => void)[] = [];
let streamListeners: ((chunk: StreamChunk) => void)[] = [];
let errorListeners: ((error: Error) => void)[] = [];
let transcriptionListeners: ((text: string) => void)[] = [];
let voiceDataListeners: ((data: Blob) => void)[] = [];
let smsListeners: ((data: any) => void)[] = [];

// Connection status types
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

// Initialize socket
export const initSocket = (token?: string) => {
  if (socket) {
    socket.disconnect();
  }
  
  const authToken = token || localStorage.getItem('access_token');
  
  socket = io(SOCKET_URL, {
    ...SOCKET_OPTIONS,
    auth: {
      token: authToken,
    },
  });
  
  // Connection events
  socket.on('connect', () => {
    isConnected = true;
    notifyConnectionListeners(true);
    console.log('Socket connected:', socket?.id);
  });
  
  socket.on('disconnect', () => {
    isConnected = false;
    notifyConnectionListeners(false);
    console.log('Socket disconnected');
  });
  
  socket.on('connect_error', (error: Error) => {
    console.error('Socket connection error:', error);
    notifyErrorListeners(error);
  });
  
  socket.on('reconnect', () => {
    isConnected = true;
    notifyConnectionListeners(true);
    console.log('Socket reconnected');
  });
  
  socket.on('reconnect_attempt', () => {
    console.log('Socket reconnecting...');
  });
  
  socket.on('reconnect_error', (error: Error) => {
    console.error('Socket reconnect error:', error);
    notifyErrorListeners(error);
  });
  
  // Message events
  socket.on('message', (data: SocketMessage) => {
    if (data.event === 'message' && data.data) {
      notifyMessageListeners(data.data);
    }
  });
  
  socket.on('stream', (data: SocketMessage) => {
    if (data.event === 'stream' && data.data) {
      notifyStreamListeners(data.data);
    }
  });
  
  socket.on('transcription', (data: SocketMessage) => {
    if (data.event === 'transcription' && data.data?.text) {
      notifyTranscriptionListeners(data.data.text);
    }
  });
  
  socket.on('voice:data', (data: SocketMessage) => {
    if (data.event === 'voice:data' && data.data) {
      // Handle voice data
      if (data.data.audio) {
        const audioBlob = new Blob([data.data.audio], { type: 'audio/wav' });
        notifyVoiceDataListeners(audioBlob);
      }
    }
  });
  
  socket.on('sms:received', (data: SocketMessage) => {
    notifySMSListeners(data.data);
  });
  
  socket.on('sms:sent', (data: SocketMessage) => {
    notifySMSListeners(data.data);
  });
  
  socket.on('error', (error: Error) => {
    notifyErrorListeners(error);
    toast.error(error.message || 'Socket error');
  });
  
  return socket;
};

// Connect socket
export const connectSocket = () => {
  if (socket && !socket.connected) {
    socket.connect();
  }
};

// Disconnect socket
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    isConnected = false;
    notifyConnectionListeners(false);
  }
};

// Check connection status
export const getConnectionStatus = (): ConnectionStatus => {
  if (!socket) return 'disconnected';
  if (socket.connected) return 'connected';
  if (socket.connecting) return 'connecting';
  return 'disconnected';
};

// Check if connected
export const isSocketConnected = (): boolean => {
  return isConnected && socket?.connected;
};

// Get socket ID
export const getSocketId = (): string | undefined => {
  return socket?.id;
};

// ============================================
// Listener Functions
// ============================================

// Connection listeners
export const onConnectionChange = (callback: (connected: boolean) => void) => {
  connectionListeners.push(callback);
  return () => {
    connectionListeners = connectionListeners.filter((cb) => cb !== callback);
  };
};

const notifyConnectionListeners = (connected: boolean) => {
  connectionListeners.forEach((callback) => callback(connected));
};

// Message listeners
export const onMessage = (callback: (message: Message) => void) => {
  messageListeners.push(callback);
  return () => {
    messageListeners = messageListeners.filter((cb) => cb !== callback);
  };
};

const notifyMessageListeners = (message: Message) => {
  messageListeners.forEach((callback) => callback(message));
};

// Stream listeners
export const onStream = (callback: (chunk: StreamChunk) => void) => {
  streamListeners.push(callback);
  return () => {
    streamListeners = streamListeners.filter((cb) => cb !== callback);
  };
};

const notifyStreamListeners = (chunk: StreamChunk) => {
  streamListeners.forEach((callback) => callback(chunk));
};

// Error listeners
export const onError = (callback: (error: Error) => void) => {
  errorListeners.push(callback);
  return () => {
    errorListeners = errorListeners.filter((cb) => cb !== callback);
  };
};

const notifyErrorListeners = (error: Error) => {
  errorListeners.forEach((callback) => callback(error));
};

// Transcription listeners
export const onTranscription = (callback: (text: string) => void) => {
  transcriptionListeners.push(callback);
  return () => {
    transcriptionListeners = transcriptionListeners.filter((cb) => cb !== callback);
  };
};

const notifyTranscriptionListeners = (text: string) => {
  transcriptionListeners.forEach((callback) => callback(text));
};

// Voice data listeners
export const onVoiceData = (callback: (data: Blob) => void) => {
  voiceDataListeners.push(callback);
  return () => {
    voiceDataListeners = voiceDataListeners.filter((cb) => cb !== callback);
  };
};

const notifyVoiceDataListeners = (data: Blob) => {
  voiceDataListeners.forEach((callback) => callback(data));
};

// SMS listeners
export const onSMS = (callback: (data: any) => void) => {
  smsListeners.push(callback);
  return () => {
    smsListeners = smsListeners.filter((cb) => cb !== callback);
  };
};

const notifySMSListeners = (data: any) => {
  smsListeners.forEach((callback) => callback(data));
};

// ============================================
// Emit Functions
// ============================================

// Join a conversation room
export const joinConversation = (conversationId: string) => {
  if (socket) {
    socket.emit('join:conversation', { conversation_id: conversationId });
  }
};

// Leave a conversation room
export const leaveConversation = (conversationId: string) => {
  if (socket) {
    socket.emit('leave:conversation', { conversation_id: conversationId });
  }
};

// Send a message
export const sendMessage = (message: {
  conversation_id: string;
  content: string;
  role: string;
}) => {
  if (socket) {
    socket.emit('send:message', message);
  }
};

// Start voice recording
export const startVoiceRecording = (conversationId: string) => {
  if (socket) {
    socket.emit('voice:start', { conversation_id: conversationId });
  }
};

// Stop voice recording
export const stopVoiceRecording = (conversationId: string) => {
  if (socket) {
    socket.emit('voice:stop', { conversation_id: conversationId });
  }
};

// Send voice data
export const sendVoiceData = (data: {
  conversation_id: string;
  audio: Blob;
  mimeType: string;
}) => {
  if (socket) {
    // Convert blob to base64 for socket transmission
    const reader = new FileReader();
    reader.readAsDataURL(data.audio);
    reader.onload = () => {
      socket.emit('voice:data', {
        conversation_id: data.conversation_id,
        audio: reader.result,
        mime_type: data.mimeType,
      });
    };
  }
};

// Send SMS
export const sendSMSMessage = (data: {
  to: string;
  body: string;
  conversation_id?: string;
}) => {
  if (socket) {
    socket.emit('sms:send', data);
  }
};

// Typing indicator
export const sendTyping = (conversationId: string, isTyping: boolean) => {
  if (socket) {
    socket.emit('typing', {
      conversation_id: conversationId,
      is_typing: isTyping,
    });
  }
};

// ============================================
// Cleanup
// ============================================

export const cleanupSocket = () => {
  disconnectSocket();
  connectionListeners = [];
  messageListeners = [];
  streamListeners = [];
  errorListeners = [];
  transcriptionListeners = [];
  voiceDataListeners = [];
  smsListeners = [];
};

export default {
  // Initialization
  initSocket,
  connectSocket,
  disconnectSocket,
  
  // Status
  getConnectionStatus,
  isSocketConnected,
  getSocketId,
  
  // Listeners
  onConnectionChange,
  onMessage,
  onStream,
  onError,
  onTranscription,
  onVoiceData,
  onSMS,
  
  // Emitters
  joinConversation,
  leaveConversation,
  sendMessage,
  startVoiceRecording,
  stopVoiceRecording,
  sendVoiceData,
  sendSMSMessage,
  sendTyping,
  
  // Cleanup
  cleanupSocket,
};
