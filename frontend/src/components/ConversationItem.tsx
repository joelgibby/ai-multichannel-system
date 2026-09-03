// AI Multichannel System - Conversation Item Component
import React from 'react';
import { MessageSquare, Trash2, CheckCircle, AlertCircle, Globe, Smartphone, Mic, Mail } from 'lucide-react';
import { useRouter } from 'next/router';

import { Conversation, ChannelType } from '@/types';
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
