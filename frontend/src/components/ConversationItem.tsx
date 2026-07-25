// AI Multichannel System - Conversation Item Component
import React from 'react';
import { MessageSquare, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/router';

import { Conversation, ChannelType } from '@/types';
import { Badge } from './Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isCollapsed?: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting?: boolean;
}

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  web: <Globe className="w-3 h-3" />,
  sms: <Smartphone className="w-3 h-3" />,
  voice: <Mic className="w-3 h-3" />,
  mobile: <Smartphone className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
};

const CHANNEL_COLORS: Record<ChannelType, string> = {
  web: 'text-blue-500',
  sms: 'text-green-500',
  voice: 'text-purple-500',
  mobile: 'text-emerald-500',
  email: 'text-orange-500',
};

// Import icons
const Globe = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" />
  </svg>
);

const Smartphone = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const Mic = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const Mail = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  isCollapsed = false,
  onClick,
  onDelete,
  isDeleting = false,
}) => {
  const router = useRouter();

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than a minute
    if (diff < 60000) {
      return 'Just now';
    }
    // Less than an hour
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    }
    // Less than a day
    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    }
    // Less than a week
    if (diff < 604800000) {
      return `${Math.floor(diff / 86400000)}d ago`;
    }
    // Format as date
    return date.toLocaleDateString();
  };

  // Get channel icon and color
  const channelIcon = CHANNEL_ICONS[conversation.channel] || <MessageSquare className="w-3 h-3" />;
  const channelColor = CHANNEL_COLORS[conversation.channel] || 'text-muted-foreground';

  // Get status icon
  const getStatusIcon = () => {
    switch (conversation.status) {
      case 'active':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'archived':
        return <AlertCircle className="w-3 h-3 text-yellow-500" />;
      case 'deleted':
        return <Trash2 className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`
        flex items-center gap-3 p-2 rounded-lg transition-colors
        ${isActive ? 'bg-muted' : 'hover:bg-sidebar-hover'}
        ${isCollapsed ? 'justify-center' : ''}
      `}
      onClick={onClick}
    >
      {!isCollapsed ? (
        <>
          {/* Channel icon */}
          <div className={`shrink-0 ${channelColor}`}>
            {channelIcon}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate flex-1">
                {conversation.title || `Conversation ${conversation.id.slice(0, 8)}`}
              </span>
              {getStatusIcon()}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{conversation.ai_model?.split('/').pop() || 'Default'}</span>
              <span>•</span>
              <span>{formatDate(conversation.updated_at || conversation.created_at)}</span>
            </div>
          </div>
          
          {/* Delete button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                onClick={onDelete}
                disabled={isDeleting}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Delete conversation</span>
            </TooltipContent>
          </Tooltip>
        </>
      ) : (
        /* Collapsed view */
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="p-2 rounded-lg hover:bg-sidebar-hover transition-colors w-full"
              onClick={onClick}
            >
              <div className={channelColor}>{channelIcon}</div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <div className="flex flex-col gap-1">
              <span className="font-medium">{conversation.title || `Conversation ${conversation.id.slice(0, 8)}`}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(conversation.updated_at || conversation.created_at)}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

export default ConversationItem;
