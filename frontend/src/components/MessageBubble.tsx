// AI Multichannel System - Message Bubble Component
import React, { useState, useEffect, useRef } from 'react';
import { User, Bot, Clock, AlertCircle, FileText, Image, PlayCircle, Volume2, Download, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

import { Message } from '@/types';
import { Button } from './Button';
import { Badge } from './Badge';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onRetry?: () => void;
  onDelete?: () => void;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  user: <User className="w-4 h-4" />,
  assistant: <Bot className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
};

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-primary text-primary-foreground',
  assistant: 'bg-muted text-foreground',
  system: 'bg-muted/50 text-muted-foreground',
};

const ROLE_LABELS: Record<string, string> = {
  user: 'You',
  assistant: 'AI Assistant',
  system: 'System',
};

const MESSAGE_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <FileText className="w-4 h-4" />,
  audio: <Volume2 className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  video: <PlayCircle className="w-4 h-4" />,
  file: <FileText className="w-4 h-4" />,
  command: <Terminal className="w-4 h-4" />,
};

// Terminal icon (fallback)
const Terminal = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming = false,
  onRetry,
  onDelete,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Extract metadata
  const model = message.ai_model || message.metadata?.model;
  const tokens = message.tokens_used || message.metadata?.tokens_used;
  const latency = message.latency_ms || message.metadata?.latency_ms;
  const finishReason = message.metadata?.finish_reason;

  // Determine if message has file attachment
  const hasFile = message.file_id || message.metadata?.file_id;

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format tokens
  const formatTokens = (count?: number) => {
    if (!count) return null;
    return count.toLocaleString();
  };

  // Format latency
  const formatLatency = (ms?: number) => {
    if (!ms) return null;
    return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  // Handle audio playback
  const handleAudioPlay = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  };

  // Get message type icon
  const getMessageTypeIcon = () => {
    return MESSAGE_TYPE_ICONS[message.message_type] || <FileText className="w-4 h-4" />;
  };

  // Check if content is code
  const isCodeContent = (content?: string) => {
    if (!content) return false;
    return content.startsWith('```') || content.trim().split('\n').length > 1;
  };

  // Get role color
  const getRoleColor = () => {
    return ROLE_COLORS[message.role] || 'bg-muted text-foreground';
  };

  // Get role icon
  const getRoleIcon = () => {
    return ROLE_ICONS[message.role] || <User className="w-4 h-4" />;
  };

  // Get role label
  const getRoleLabel = () => {
    return ROLE_LABELS[message.role] || message.role;
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowActions(true);
  };

  // Close actions menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll for streaming messages
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(contentRef.current);
      return () => observer.disconnect();
    }
  }, [isStreaming]);

  return (
    <div
      className={`flex gap-3 p-2 rounded-lg ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
      ref={contentRef}
    >
      {/* Avatar / Icon */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getRoleColor()}`}>
          {getRoleIcon()}
        </div>
        {message.role !== 'system' && (
          <span className="text-xs text-muted-foreground mt-1 whitespace-nowrap">
            {formatTime(message.created_at)}
          </span>
        )}
      </div>

      {/* Content */}
      <div
        className={`flex flex-col gap-2 max-w-[70%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}
      >
        {/* Header with role and metadata */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {getRoleLabel()}
          </span>
          {model && (
            <Badge variant="secondary" className="text-xs">
              {model}
            </Badge>
          )}
          {isStreaming && (
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
              <div className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>

        {/* Message content */}
        <div
          className={`rounded-lg px-4 py-2 ${getRoleColor()} ${message.role === 'user' ? 'rounded-br-none' : 'rounded-bl-none'}`}
        >
          {/* Message type indicator for non-text messages */}
          {message.message_type !== 'text' && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              {getMessageTypeIcon()}
              <span>{message.message_type}</span>
            </div>
          )}

          {/* Content based on type */}
          {message.content ? (
            isCodeContent(message.content) ? (
              <pre className="overflow-x-auto">
                <code className="text-sm">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={atomDark}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </code>
              </pre>
            ) : (
              <ReactMarkdown className="prose dark:prose-invert max-w-none text-sm">
                {message.content}
              </ReactMarkdown>
            )
          ) : (
            <span className="text-muted-foreground italic">No content</span>
          )}

          {/* File attachment */}
          {hasFile && (
            <div className="mt-3 p-3 bg-background/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium text-sm">Attached File</div>
                  <div className="text-xs text-muted-foreground">
                    {message.metadata?.filename || 'file'}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {}}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Audio content */}
          {message.message_type === 'audio' && audioUrl && (
            <div className="mt-3">
              <audio
                ref={audioRef}
                src={audioUrl}
                className="w-full"
                controls
              />
            </div>
          )}

          {/* Image content */}
          {message.message_type === 'image' && message.metadata?.image_url && (
            <div className="mt-3">
              <img
                src={message.metadata.image_url}
                alt="Uploaded image"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}

          {/* Status and metadata */}
          {(message.status !== 'completed' || tokens || latency || finishReason) && (
            <div className="mt-2 pt-2 border-t border-border/20 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {message.status !== 'completed' && (
                <div className="flex items-center gap-1">
                  {message.status === 'failed' ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                  <span>{message.status}</span>
                </div>
              )}
              {tokens && (
                <div className="flex items-center gap-1">
                  <span>Tokens: {formatTokens(tokens)}</span>
                </div>
              )}
              {latency && (
                <div className="flex items-center gap-1">
                  <span>Latency: {formatLatency(latency)}</span>
                </div>
              )}
              {finishReason && (
                <div className="flex items-center gap-1">
                  <span>Finished: {finishReason}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions menu */}
        {showActions && (
          <div className="absolute top-full mt-1 bg-background border border-border rounded-lg shadow-lg p-2 space-y-1 z-50">
            {message.status === 'failed' && onRetry && (
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded"
                onClick={onRetry}
              >
                Retry
              </button>
            )}
            {onDelete && (
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded text-destructive"
                onClick={onDelete}
              >
                Delete
              </button>
            )}
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded"
              onClick={() => navigator.clipboard.writeText(message.content || '')}
            >
              Copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
