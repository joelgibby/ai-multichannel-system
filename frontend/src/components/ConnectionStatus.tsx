// AI Multichannel System - Connection Status Component
import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertTriangle, CheckCircle } from 'lucide-react';

import { initSocket, isSocketConnected, getConnectionStatus, onConnectionChange, cleanupSocket } from '@/services/socket';

interface ConnectionStatusProps {
  showLabel?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showLabel = true,
}) => {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  // Initialize socket and listen for connection changes
  useEffect(() => {
    // Initialize socket
    initSocket();

    // Check initial status
    setStatus(getConnectionStatus());

    // Listen for connection changes
    const unsubscribe = onConnectionChange((connected) => {
      setStatus(connected ? 'connected' : 'disconnected');
    });

    // Cleanup
    return () => {
      unsubscribe();
      cleanupSocket();
    };
  }, []);

  // Get status info
  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
          label: 'Connected',
          color: 'text-green-500',
          tooltip: 'Connected to server',
        };
      case 'connecting':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
          label: 'Connecting',
          color: 'text-yellow-500',
          tooltip: 'Connecting to server...',
        };
      case 'disconnected':
      default:
        return {
          icon: <WifiOff className="w-4 h-4 text-red-500" />,
          label: 'Disconnected',
          color: 'text-red-500',
          tooltip: 'Disconnected from server',
        };
    }
  };

  const { icon, label, color, tooltip } = getStatusInfo();

  return (
    <div className="flex items-center gap-2" title={tooltip}>
      <div className={color}>{icon}</div>
      {showLabel && (
        <span className={`text-sm ${color}`}>{label}</span>
      )}
    </div>
  );
};

export default ConnectionStatus;
