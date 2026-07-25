// AI Multichannel System - Channel Selector Component
import React, { useState } from 'react';
import { Globe, Smartphone, Mic, Mail, ChevronDown, Check } from 'lucide-react';

import { ChannelType } from '@/types';
import { Button } from './Button';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

interface ChannelSelectorProps {
  value?: ChannelType;
  onChange?: (channel: ChannelType) => void;
  disabled?: boolean;
}

const CHANNELS: { value: ChannelType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'web', label: 'Web Chat', icon: <Globe className="w-4 h-4" />, color: 'text-blue-500' },
  { value: 'sms', label: 'SMS', icon: <Smartphone className="w-4 h-4" />, color: 'text-green-500' },
  { value: 'voice', label: 'Voice Call', icon: <Mic className="w-4 h-4" />, color: 'text-purple-500' },
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4" />, color: 'text-orange-500' },
];

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  value = 'web',
  onChange,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const selectedChannel = CHANNELS.find((c) => c.value === value) || CHANNELS[0];

  const handleSelect = (channel: ChannelType) => {
    onChange?.(channel);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-[140px] justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <span className={selectedChannel.color}>{selectedChannel.icon}</span>
            <span className="text-sm">{selectedChannel.label}</span>
          </div>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-2" align="start">
        <div className="flex flex-col gap-1">
          {CHANNELS.map((channel) => (
            <button
              key={channel.value}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors hover:bg-muted ${
                value === channel.value ? 'bg-muted' : ''
              }`}
              onClick={() => handleSelect(channel.value)}
            >
              <span className={channel.color}>{channel.icon}</span>
              <span className="flex-1 text-left">{channel.label}</span>
              {value === channel.value && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ChannelSelector;
