// AI Multichannel System - Settings Modal Component
import React, { useState, useEffect } from 'react';
import { Settings, Brain, Thermometer, Type, Mic, Moon, Sun, Monitor } from 'lucide-react';

import { AIModel } from '@/types';
import { Button } from './Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { Slider } from './Slider';
import { AVAILABLE_VOICES } from '@/services/voice';

function formatTokenPrice(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(6) : '0.000000';
}

interface SettingsModalProps {
  aiModel: string;
  temperature: number;
  maxTokens: number;
  voiceId: string;
  availableModels: AIModel[];
  onAIModelChange: (model: string) => void;
  onTemperatureChange: (temperature: number) => void;
  onMaxTokensChange: (maxTokens: number) => void;
  onVoiceIdChange: (voiceId: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  aiModel,
  temperature,
  maxTokens,
  voiceId,
  availableModels,
  onAIModelChange,
  onTemperatureChange,
  onMaxTokensChange,
  onVoiceIdChange,
}) => {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Load saved theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Save theme
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // Apply theme immediately
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'light') {
      root.classList.add('light');
    }
  };

  // Theme options
  const themeOptions = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
  ];

  // Voice options
  const voiceOptions = AVAILABLE_VOICES.map((voice) => ({
    value: voice.id,
    label: `${voice.name} (${voice.language})`,
    icon: voice.gender === 'female' ? '♀' : '♂',
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="p-2">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Appearance
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  className={`p-3 rounded-lg border transition-colors ${
                    theme === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted'
                  }`}
                  onClick={() => handleThemeChange(option.value as 'light' | 'dark' | 'system')}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xl">{option.icon}</span>
                    <span className="text-xs">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Model Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Model
            </h3>
            <Select
              value={aiModel}
              onValueChange={onAIModelChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.length > 0 ? (
                  availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.provider} - ${formatTokenPrice(model.pricing?.prompt)}/token
                        </span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="mistralai/mistral-nemo">
                    Mistral Nemo (Default)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Temperature Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              Temperature: {temperature}
            </h3>
            <Slider
              value={temperature}
              onValueChange={onTemperatureChange}
              min={0}
              max={2}
              step={0.1}
              showValue={false}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max Tokens Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Type className="w-4 h-4" />
              Max Tokens: {maxTokens}
            </h3>
            <Slider
              value={maxTokens}
              onValueChange={onMaxTokensChange}
              min={256}
              max={8192}
              step={256}
              showValue={false}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>256</span>
              <span>4096</span>
              <span>8192</span>
            </div>
          </div>

          {/* Voice Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Voice Settings
            </h3>
            <Select
              value={voiceId}
              onValueChange={onVoiceIdChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select voice" />
              </SelectTrigger>
              <SelectContent>
                {voiceOptions.map((voice) => (
                  <SelectItem key={voice.value} value={voice.value}>
                    <div className="flex items-center gap-2">
                      <span>{voice.icon}</span>
                      <span>{voice.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
