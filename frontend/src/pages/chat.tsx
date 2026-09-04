// AI Multichannel System - Chat Page
import React, { useEffect, useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Mic, MicOff, Send, Paperclip, X, Settings, Plus, Loader2, Bot, User, FileText, Image, Volume2, StopCircle } from 'lucide-react';

import { useApp } from '@/context/AppContext';
import { initRecording, startRecording, stopRecording, cleanupRecording, getRecordingStatus, playAudio, stopPlayback, formatTime, AVAILABLE_VOICES } from '@/services/voice';
import { ChannelType } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { MessageBubble } from '@/components/MessageBubble';
import { SettingsModal } from '@/components/SettingsModal';
import { ChannelSelector } from '@/components/ChannelSelector';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import toast from 'react-hot-toast';

const VoiceRecorder = dynamic(
  () => import('@/components/VoiceRecorder').then((mod) => mod.VoiceRecorder),
  { ssr: false }
);

// Typing indicator component
const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-2 p-4 rounded-lg bg-muted">
    <div className="flex gap-1">
      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
    <span className="text-sm text-muted-foreground">AI is typing...</span>
  </div>
);

const CHANNEL_COPY: Record<ChannelType, { title: string; body: string; composer: boolean }> = {
  web: {
    title: 'Welcome to AI Multichannel',
    body: 'Start a conversation with AI using voice, text, or upload files.',
    composer: true,
  },
  sms: {
    title: 'SMS conversations',
    body: 'Threads appear here when someone texts your Twilio number. Replies are sent as SMS, not from this composer.',
    composer: false,
  },
  voice: {
    title: 'Voice calls',
    body: 'Call threads appear here when Twilio hits the voice webhook. Use the number in Twilio, not this composer.',
    composer: false,
  },
  email: {
    title: 'Email',
    body: 'Email threads are not wired to a composer yet.',
    composer: false,
  },
  mobile: {
    title: 'Mobile',
    body: 'Mobile threads are not wired to a composer yet.',
    composer: false,
  },
};

// Welcome message component
const WelcomeMessage: React.FC<{ channel: ChannelType }> = ({ channel }) => {
  const copy = CHANNEL_COPY[channel] || CHANNEL_COPY.web;
  return (
  <div className="flex flex-col items-center justify-center h-full text-center p-8">
    <div className="mb-6">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
        <Bot className="w-10 h-10 text-white" />
      </div>
    </div>
    <h1 className="text-3xl font-bold mb-2">{copy.title}</h1>
    <p className="text-lg text-muted-foreground mb-6 max-w-md">
      {copy.body}
    </p>
    {copy.composer && (
    <div className="flex gap-4">
      <button className="btn btn-primary gap-2">
        <Mic className="w-4 h-4" />
        Start Voice Chat
      </button>
      <button className="btn btn-outline gap-2">
        <Paperclip className="w-4 h-4" />
        Upload File
      </button>
    </div>
    )}
  </div>
  );
};

// Input area component
interface InputAreaProps {
  onSend: (content: string) => void;
  onVoiceRecord: () => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  isRecording: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, onVoiceRecord, onFileUpload, isLoading, isRecording }) => {
  const [inputValue, setInputValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      onSend(inputValue.trim());
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onFileUpload(e.target.files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          onFileUpload(blob);
        }
      }
    }
  };

  const autoResize = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [inputValue, autoResize]);

  return (
    <div className="border-t border-border p-4 bg-background/50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end gap-3">
          {/* File upload button */}
          <button
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => fileInputRef.current?.click()}
            title="Upload file"
          >
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="audio/*,image/*,video/*,.pdf,.txt,.doc,.docx"
          />

          {/* Voice record button */}
          <button
            className={`p-2 rounded-lg transition-colors ${isRecording ? 'bg-red-500 text-white' : 'hover:bg-muted'}`}
            onClick={onVoiceRecord}
            title={isRecording ? 'Stop recording' : 'Start voice recording'}
          >
            {isRecording ? (
              <StopCircle className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onPaste={handlePaste}
            placeholder={isLoading ? "Waiting for response..." : "Type your message..."}
            disabled={isLoading || isRecording}
            className="flex-1 resize-none bg-background border border-input rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-[200px]"
            rows={1}
          />

          {/* Send button */}
          <button
            className={`p-2 rounded-lg transition-colors ${inputValue.trim() && !isLoading ? 'hover:bg-primary/10' : 'opacity-50 cursor-not-allowed'}`}
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || isRecording}
            title="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-primary" />
            )}
          </button>
        </div>
        
        {/* Quick actions */}
        <div className="mt-2 flex gap-2">
          <button className="text-xs text-muted-foreground hover:text-foreground">/help</button>
          <button className="text-xs text-muted-foreground hover:text-foreground">/clear</button>
          <button className="text-xs text-muted-foreground hover:text-foreground">/new</button>
        </div>
      </div>
    </div>
  );
};

// Main chat component
const ChatPage: React.FC = () => {
  const router = useRouter();
  const {
    // State
    chat: { messages, isLoading, isStreaming, currentStream, conversation, error },
    voice: { isRecording, isPlaying, recordingTime, audioBlob, audioUrl, transcription, isTranscribing },
    files: { isUploading, uploadProgress },
    settings: { aiModel, temperature, maxTokens, voiceId, theme, availableModels },
    conversations,
    activeConversationId,
    isAuthenticated,
    
    // Actions
    sendChatMessage,
    sendVoiceMessage,
    uploadFile,
    createNewConversation,
    switchConversation,
    deleteConversation,
    setActiveConversation,
    setConversation,
    setMessages,
    setTheme,
    setAIModel,
    setTemperature,
    setMaxTokens,
    setVoiceId,
  } = useApp();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('web');
  const canCompose = CHANNEL_COPY[selectedChannel]?.composer ?? true;
  const channelConversations = conversations.filter(
    (conversation) => conversation.channel === selectedChannel
  );

  // Initialize conversation on mount
  useEffect(() => {
    if (isAuthenticated && selectedChannel === 'web' && !activeConversationId && conversations.length === 0) {
      createNewConversation('web');
    }
  }, [isAuthenticated, activeConversationId, conversations.length, createNewConversation, selectedChannel]);

  useEffect(() => {
    const matches = conversations.filter((conversation) => conversation.channel === selectedChannel);
    if (activeConversationId && matches.some((conversation) => conversation.id === activeConversationId)) {
      return;
    }
    if (matches.length > 0) {
      switchConversation(matches[0].id);
      return;
    }
    if (conversations.length === 0 && selectedChannel === 'web') {
      return;
    }
    setActiveConversation(undefined);
    setConversation(undefined);
    setMessages([]);
  }, [selectedChannel, conversations, activeConversationId, switchConversation, setActiveConversation, setConversation, setMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle streaming responses
  useEffect(() => {
    if (currentStream) {
      // In a real implementation, we would append the stream chunk to the last message
      // For now, we'll just log it
      console.log('Stream chunk:', currentStream);
    }
  }, [currentStream]);

  // Handle voice recording
  const handleVoiceRecord = async () => {
    if (isRecording) {
      // Stop recording
      const result = stopRecording();
      if (result.blob) {
        await sendVoiceMessage(result.blob);
      }
      cleanupRecording();
    } else {
      // Start recording
      const initialized = await initRecording();
      if (initialized) {
        startRecording();
      }
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    await uploadFile(file);
  };

  // Handle new conversation
  const handleNewConversation = async () => {
    if (!canCompose) {
      toast('This channel is created by inbound Twilio traffic, not from New Chat.');
      return;
    }
    const newConversation = await createNewConversation('web');
    setActiveConversation(newConversation.id);
  };

  // Handle send message
  const handleSendMessage = async (content: string) => {
    if (!canCompose) {
      return;
    }
    if (!activeConversationId) {
      const newConversation = await createNewConversation('web');
      setActiveConversation(newConversation.id);
    }
    await sendChatMessage(content);
  };

  // Handle conversation switch
  const handleSwitchConversation = (id: string) => {
    switchConversation(id);
  };

  // Handle theme toggle
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(newTheme);
  };

  // Check if we should show welcome message
  const showWelcome = messages.length === 0 && !isLoading;

  return (
    <>
      <Head>
        <title>Chat - AI Multichannel System</title>
        <meta name="description" content="Chat with AI using voice, text, or files" />
      </Head>

      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <Sidebar
          conversations={channelConversations}
          activeConversationId={activeConversationId}
          onSwitchConversation={handleSwitchConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={deleteConversation}
          onSettingsClick={() => {}}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="border-b border-border p-4 flex items-center justify-between bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <ConnectionStatus />
              <ChannelSelector
                value={selectedChannel}
                onChange={setSelectedChannel}
              />
            </div>
            
            <div className="flex items-center gap-4">
              <button
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                onClick={toggleTheme}
                title="Toggle theme"
              >
                {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🌍'}
              </button>
              <SettingsModal
                aiModel={aiModel}
                temperature={temperature}
                maxTokens={maxTokens}
                voiceId={voiceId}
                availableModels={availableModels}
                onAIModelChange={setAIModel}
                onTemperatureChange={setTemperature}
                onMaxTokensChange={setMaxTokens}
                onVoiceIdChange={setVoiceId}
              />
            </div>
          </header>

          {/* Messages area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {showWelcome ? (
              <WelcomeMessage channel={selectedChannel} />
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isStreaming={isStreaming && message.role === 'assistant'}
                  />
                ))}
                
                {isLoading && <TypingIndicator />}
                
                {error && (
                  <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {error}
                  </div>
                )}
              </>
            )}
            
            {/* Voice recording display */}
            {isRecording && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm">Recording... {formatTime(recordingTime)}</span>
                </div>
                <div className="mt-2 h-20 bg-muted rounded-lg overflow-hidden">
                  <VoiceRecorder />
                </div>
              </div>
            )}

            {/* Voice transcription display */}
            {transcription && (
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Transcription:</span>
                </div>
                <p className="text-sm">{transcription}</p>
                {isTranscribing && (
                  <div className="mt-2 flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            )}

            {/* Audio playback */}
            {audioUrl && (
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-4">
                  <button
                    className="p-2 rounded-full hover:bg-muted-foreground/10"
                    onClick={() => isPlaying ? stopPlayback() : playAudio(audioUrl)}
                  >
                    {isPlaying ? (
                      <StopCircle className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="h-2 bg-muted-foreground/20 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: '0%' }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(getRecordingStatus().duration)}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {canCompose ? (
          <InputArea
            onSend={handleSendMessage}
            onVoiceRecord={handleVoiceRecord}
            onFileUpload={handleFileUpload}
            isLoading={isLoading || isUploading}
            isRecording={isRecording}
          />
          ) : (
            <div className="border-t border-border p-4 bg-background/50 backdrop-blur-sm">
              <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto">
                {CHANNEL_COPY[selectedChannel]?.body}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* File upload progress */}
      {isUploading && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-background border border-border rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Uploading... {uploadProgress}%</span>
          </div>
          <div className="mt-2 h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ChatPage;
