// AI Multichannel System - Voice Recorder Component
import React, { useEffect, useRef, useState } from 'react';
import { Mic, StopCircle, Volume2, Loader2 } from 'lucide-react';

import { drawAudioVisualization, stopAudioVisualization, getAudioData, cleanupRecording } from '@/services/voice';

interface VoiceRecorderProps {
  onStart?: () => void;
  onStop?: (blob: Blob | null, url: string | null, duration: number) => void;
  onError?: (error: Error) => void;
  isRecording?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onStart,
  onStop,
  onError,
  isRecording: externalIsRecording,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Sync with external state
  useEffect(() => {
    if (externalIsRecording !== undefined) {
      setIsRecording(externalIsRecording);
      if (externalIsRecording) {
        setStartTime(Date.now());
        startTimer();
      } else {
        stopTimer();
      }
    }
  }, [externalIsRecording]);

  // Start recording
  const startRecording = async () => {
    try {
      setIsRecording(true);
      setStartTime(Date.now());
      startTimer();
      onStart?.();
    } catch (error) {
      onError?.(error as Error);
      setIsRecording(false);
    }
  };

  // Stop recording
  const stopRecording = () => {
    stopTimer();
    setIsRecording(false);
    setStartTime(null);
    setRecordingTime(0);
  };

  // Start timer
  const startTimer = () => {
    if (timer) clearInterval(timer);
    const newTimer = setInterval(() => {
      if (startTime) {
        setRecordingTime((Date.now() - startTime) / 1000);
      }
    }, 100);
    setTimer(newTimer);
  };

  // Stop timer
  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Draw visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isRecording) return;

    const animate = () => {
      drawAudioVisualization(canvas, '#3b82f6');
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      stopAudioVisualization();
    };
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      stopAudioVisualization();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-muted/50 rounded-lg">
      {/* Visualization */}
      <canvas
        ref={canvasRef}
        width={200}
        height={60}
        className="w-full h-16 rounded-lg"
      />

      {/* Timer */}
      <div className="text-2xl font-mono tabular-nums">
        {formatTime(recordingTime)}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        {!isRecording ? (
          <button
            className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={startRecording}
            title="Start recording"
          >
            <Mic className="w-6 h-6" />
          </button>
        ) : (
          <button
            className="p-3 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors animate-pulse"
            onClick={stopRecording}
            title="Stop recording"
          >
            <StopCircle className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Status */}
      <div className="text-sm text-muted-foreground">
        {isRecording ? 'Recording...' : 'Click to start recording'}
      </div>
    </div>
  );
};

export default VoiceRecorder;
