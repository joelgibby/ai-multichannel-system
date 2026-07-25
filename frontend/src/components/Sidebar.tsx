// AI Multichannel System - Sidebar Component
import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Settings, Trash2, X, Search, Home, Users, FileText, Mic, Smartphone, Globe } from 'lucide-react';

import { Conversation, ChannelType } from '@/types';
import { ConversationItem } from './ConversationItem';
import { Button } from './Button';
import { Input } from './Input';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSwitchConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => Promise<void>;
  onSettingsClick: () => void;
}

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  web: <Globe className="w-4 h-4" />,
  sms: <Smartphone className="w-4 h-4" />,
  voice: <Mic className="w-4 h-4" />,
  mobile: <Smartphone className="w-4 h-4" />,
  email: <MessageSquare className="w-4 h-4" />,
};

const CHANNEL_COLORS: Record<ChannelType, string> = {
  web: 'text-blue-500',
  sms: 'text-green-500',
  voice: 'text-purple-500',
  mobile: 'text-emerald-500',
  email: 'text-orange-500',
};

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSwitchConversation,
  onNewConversation,
  onDeleteConversation,
  onSettingsClick,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conversation) => {
    const query = searchQuery.toLowerCase();
    return (
      conversation.title?.toLowerCase().includes(query) ||
      conversation.id.includes(query) ||
      conversation.ai_model?.toLowerCase().includes(query)
    );
  });

  // Group conversations by date
  const groupConversationsByDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const groups: { [key: string]: Conversation[] } = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };
    
    filteredConversations.forEach((conversation) => {
      const date = new Date(conversation.updated_at || conversation.created_at);
      
      if (date >= today) {
        groups.today.push(conversation);
      } else if (date >= yesterday) {
        groups.yesterday.push(conversation);
      } else if (date >= thisWeek) {
        groups.thisWeek.push(conversation);
      } else {
        groups.older.push(conversation);
      }
    });
    
    return Object.entries(groups).filter(([_, convs]) => convs.length > 0);
  };

  const conversationGroups = groupConversationsByDate();

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(id);
    try {
      await onDeleteConversation(id);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-sidebar text-sidebar-foreground border-r border-border z-20 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Logo / Brand */}
      <div className="h-16 flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">AI Multichannel</span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <MessageSquare className="w-5 h-5 text-primary-foreground" />
          </div>
        )}
        
        <button
          className="p-1 rounded-lg hover:bg-sidebar-hover transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <X className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* New chat button */}
      <div className="p-3">
        <Button
          className="w-full justify-start gap-2"
          onClick={onNewConversation}
        >
          <Plus className="w-4 h-4" />
          {!isCollapsed && 'New Chat'}
        </Button>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="px-3 pb-3">
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-sidebar-hover border-border"
            leftIcon={<Search className="w-4 h-4 text-muted-foreground" />}
          />
        </div>
      )}

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {conversationGroups.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {!searchQuery ? 'No conversations yet' : 'No conversations found'}
          </div>
        ) : (
          conversationGroups.map(([groupName, conversations]) => (
            <div key={groupName} className="px-3 py-2">
              {!isCollapsed && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {groupName.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
              )}
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={activeConversationId === conversation.id}
                    isCollapsed={isCollapsed}
                    onClick={() => onSwitchConversation(conversation.id)}
                    onDelete={(e) => handleDelete(conversation.id, e)}
                    isDeleting={isDeleting === conversation.id}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom section */}
      <div className="p-3 border-t border-border">
        {!isCollapsed ? (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={onSettingsClick}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        ) : (
          <button
            className="w-full p-2 rounded-lg hover:bg-sidebar-hover transition-colors"
            onClick={onSettingsClick}
            title="Settings"
          >
            <Settings className="w-5 h-5 mx-auto" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
