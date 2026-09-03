// AI Multichannel System - Voice Recording Service
// Handles audio recording, playback, and processing

import toast from 'react-hot-toast';

import {
  VoiceSettings,
  RecordingOptions,
  PlaybackOptions,
} from '@/types';

type AudioRecorder = {
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  ondataavailable?: (blob: Blob) => void;
  onstop?: () => void;
  onerror?: (error: Error) => void;
  state?: string;
};

async function loadRecordRTC(): Promise<new (stream: MediaStream, options: Record<string, unknown>) => AudioRecorder> {
  if (typeof window === 'undefined') {
    throw new Error('RecordRTC can only load in the browser');
  }
  const mod = await import('recordrtc');
  return (mod.default ?? mod) as new (
    stream: MediaStream,
    options: Record<string, unknown>
  ) => AudioRecorder;
}

// Default settings
const DEFAULT_RECORDING_OPTIONS: RecordingOptions = {
  mimeType: 'audio/wav',
  sampleRate: 44100,
  bitsPerSecond: 128000,
};

const DEFAULT_PLAYBACK_OPTIONS: PlaybackOptions = {
  volume: 1.0,
  playbackRate: 1.0,
};

// State
let mediaStream: MediaStream | null = null;
let recorder: AudioRecorder | null = null;
let audioChunks: Blob[] = [];
let audioBlob: Blob | null = null;
let audioUrl: string | null = null;
let isRecording = false;
let recordingStartTime: number | null = null;
let recordingTimer: NodeJS.Timeout | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;

// ============================================
// Recording Functions
// ============================================

/**
 * Initialize audio recording
 */
export const initRecording = async (
  options: Partial<RecordingOptions> = {}
): Promise<boolean> => {
  try {
    // Cleanup any existing stream
    cleanupRecording();
    
    // Merge options
    const recordingOptions: RecordingOptions = {
      ...DEFAULT_RECORDING_OPTIONS,
      ...options,
    };
    
    // Request microphone access
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: options.deviceId,
        sampleRate: recordingOptions.sampleRate,
        channelCount: 1,
      },
      video: false,
    });
    
    // RecordRTC overwrites global URL if it loads on the Next.js server
    const RecordRTC = await loadRecordRTC();
    recorder = new RecordRTC(mediaStream, {
      type: 'audio',
      mimeType: recordingOptions.mimeType,
      sampleRate: recordingOptions.sampleRate,
      bitsPerSecond: recordingOptions.bitsPerSecond,
      numberOfAudioChannels: 1,
      timeSlice: 1000,
    });
    
    // Setup audio visualization
    setupAudioVisualization(mediaStream);
    
    // Event handlers
    recorder.ondataavailable = (blob: Blob) => {
      audioChunks.push(blob);
    };
    
    recorder.onstop = () => {
      stopRecordingTimer();
      audioBlob = new Blob(audioChunks, { type: recordingOptions.mimeType });
      audioUrl = URL.createObjectURL(audioBlob);
      audioChunks = [];
    };
    
    recorder.onerror = (error: Error) => {
      console.error('Recording error:', error);
      toast.error('Recording error: ' + error.message);
      cleanupRecording();
    };
    
    return true;
  } catch (error) {
    console.error('Failed to initialize recording:', error);
    toast.error('Could not access microphone. Please check permissions.');
    cleanupRecording();
    return false;
  }
};

/**
 * Start recording
 */
export const startRecording = (): boolean => {
  if (!recorder || !mediaStream) {
    toast.error('Recording not initialized');
    return false;
  }
  
  if (isRecording) {
    return true;
  }
  
  // Reset state
  audioChunks = [];
  audioBlob = null;
  audioUrl = null;
  
  // Start recording
  recorder.startRecording();
  isRecording = true;
  recordingStartTime = Date.now();
  
  // Start timer
  startRecordingTimer();
  
  return true;
};

/**
 * Stop recording
 */
export const stopRecording = (): { blob: Blob | null; url: string | null; duration: number } => {
  if (!recorder || !isRecording) {
    return { blob: null, url: null, duration: 0 };
  }
  
  // Stop recording
  recorder.stopRecording();
  isRecording = false;
  
  // Calculate duration
  const duration = recordingStartTime ? (Date.now() - recordingStartTime) / 1000 : 0;
  
  return {
    blob: audioBlob,
    url: audioUrl,
    duration,
  };
};

/**
 * Pause recording
 */
export const pauseRecording = (): boolean => {
  if (!recorder || !isRecording) {
    return false;
  }
  
  recorder.pauseRecording();
  stopRecordingTimer();
  return true;
};

/**
 * Resume recording
 */
export const resumeRecording = (): boolean => {
  if (!recorder || isRecording) {
    return false;
  }
  
  recorder.resumeRecording();
  startRecordingTimer();
  return true;
};

/**
 * Get current recording status
 */
export const getRecordingStatus = (): {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  hasRecording: boolean;
} => {
  const duration = recordingStartTime ? (Date.now() - recordingStartTime) / 1000 : 0;
  
  return {
    isRecording,
    isPaused: recorder?.state === 'paused' || false,
    duration,
    hasRecording: !!audioBlob || audioChunks.length > 0,
  };
};

/**
 * Get current audio blob
 */
export const getAudioBlob = (): Blob | null => {
  return audioBlob;
};

/**
 * Get current audio URL
 */
export const getAudioUrl = (): string | null => {
  return audioUrl;
};

/**
 * Get recorded audio duration
 */
export const getAudioDuration = (): number => {
  if (!audioBlob) return 0;
  return audioBlob.size / (DEFAULT_RECORDING_OPTIONS.bitsPerSecond / 8);
};

// ============================================
// Playback Functions
// ============================================

let audioElement: HTMLAudioElement | null = null;
let isPlaying = false;

/**
 * Play audio from blob or URL
 */
export const playAudio = (
  source: Blob | string,
  options: Partial<PlaybackOptions> = {}
): boolean => {
  try {
    // Stop any currently playing audio
    stopPlayback();
    
    // Create audio element
    audioElement = new Audio();
    
    // Set playback options
    const playbackOptions: PlaybackOptions = {
      ...DEFAULT_PLAYBACK_OPTIONS,
      ...options,
    };
    
    audioElement.volume = playbackOptions.volume;
    audioElement.playbackRate = playbackOptions.playbackRate;
    
    // Setup event handlers
    audioElement.onended = () => {
      isPlaying = false;
    };
    
    audioElement.onerror = (error) => {
      console.error('Audio playback error:', error);
      toast.error('Error playing audio');
      isPlaying = false;
    };
    
    // Set source
    if (source instanceof Blob) {
      const url = URL.createObjectURL(source);
      audioElement.src = url;
    } else {
      audioElement.src = source;
    }
    
    // Play
    audioElement.play().then(() => {
      isPlaying = true;
    }).catch((error) => {
      console.error('Playback failed:', error);
      toast.error('Could not play audio');
      isPlaying = false;
    });
    
    return true;
  } catch (error) {
    console.error('Failed to play audio:', error);
    toast.error('Failed to play audio');
    return false;
  }
};

/**
 * Stop audio playback
 */
export const stopPlayback = (): void => {
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement = null;
  }
  isPlaying = false;
};

/**
 * Pause audio playback
 */
export const pausePlayback = (): void => {
  if (audioElement && !audioElement.paused) {
    audioElement.pause();
    isPlaying = false;
  }
};

/**
 * Resume audio playback
 */
export const resumePlayback = (): void => {
  if (audioElement && audioElement.paused) {
    audioElement.play().then(() => {
      isPlaying = true;
    });
  }
};

/**
 * Get playback status
 */
export const getPlaybackStatus = (): {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
} => {
  if (!audioElement) {
    return { isPlaying: false, currentTime: 0, duration: 0 };
  }
  
  return {
    isPlaying,
    currentTime: audioElement.currentTime,
    duration: audioElement.duration,
  };
};

/**
 * Seek to position in audio
 */
export const seekAudio = (time: number): void => {
  if (audioElement) {
    audioElement.currentTime = time;
  }
};

// ============================================
// Audio Visualization
// ============================================

let canvasCtx: CanvasRenderingContext2D | null = null;
let canvasElement: HTMLCanvasElement | null = null;

/**
 * Setup audio visualization
 */
const setupAudioVisualization = (stream: MediaStream) => {
  try {
    // Create audio context
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create analyser
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    // Create source from stream
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    // Create data array
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  } catch (error) {
    console.warn('Audio visualization not available:', error);
  }
};

/**
 * Get audio frequency data for visualization
 */
export const getAudioData = (): { data: Uint8Array | null; width: number; height: number } => {
  if (!analyser || !dataArray) {
    return { data: null, width: 0, height: 0 };
  }
  
  analyser.getByteFrequencyData(dataArray);
  
  return {
    data: dataArray,
    width: analyser.frequencyBinCount,
    height: 256,
  };
};

/**
 * Draw audio visualization on canvas
 */
export const drawAudioVisualization = (
  canvas: HTMLCanvasElement,
  color: string = '#3b82f6'
): void => {
  canvasElement = canvas;
  canvasCtx = canvas.getContext('2d');
  
  if (!canvasCtx || !analyser || !dataArray) return;
  
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  canvasCtx.clearRect(0, 0, width, height);
  
  // Draw waveform
  analyser.getByteFrequencyData(dataArray);
  
  const barWidth = (width / analyser.frequencyBinCount) * 2.5;
  let x = 0;
  
  for (let i = 0; i < analyser.frequencyBinCount; i++) {
    const barHeight = (dataArray[i] / 255) * height;
    
    canvasCtx.fillStyle = color;
    canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
    
    x += barWidth + 1;
  }
  
  // Continue animation
  requestAnimationFrame(() => drawAudioVisualization(canvas, color));
};

/**
 * Stop audio visualization
 */
export const stopAudioVisualization = (): void => {
  if (canvasCtx && canvasElement) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  }
  canvasCtx = null;
  canvasElement = null;
};

// ============================================
// Timer Functions
// ============================================

/**
 * Start recording timer
 */
const startRecordingTimer = (): void => {
  if (recordingTimer) {
    clearInterval(recordingTimer);
  }
  
  recordingTimer = setInterval(() => {
    // Timer updates are handled by getRecordingStatus
  }, 100);
};

/**
 * Stop recording timer
 */
const stopRecordingTimer = (): void => {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
};

/**
 * Format time as MM:SS
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// ============================================
// Device Management
// ============================================

/**
 * Get available audio input devices
 */
export const getAudioInputDevices = async (): Promise<MediaDeviceInfo[]> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audioinput');
  } catch (error) {
    console.error('Failed to get audio devices:', error);
    return [];
  }
};

/**
 * Get available audio output devices
 */
export const getAudioOutputDevices = async (): Promise<MediaDeviceInfo[]> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audiooutput');
  } catch (error) {
    console.error('Failed to get audio devices:', error);
    return [];
  }
};

/**
 * Check microphone permissions
 */
export const checkMicrophonePermission = async (): Promise<boolean> => {
  try {
    const permission = await navigator.permissions.query({
      name: 'microphone' as any,
    });
    return permission.state === 'granted';
  } catch (error) {
    // Fallback for browsers that don't support permissions API
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Request microphone permission
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    return false;
  }
};

// ============================================
// Cleanup Functions
// ============================================

/**
 * Cleanup all recording resources
 */
export const cleanupRecording = (): void => {
  // Stop recording
  if (recorder && isRecording) {
    recorder.stopRecording();
  }
  
  // Stop all media tracks
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  
  // Clear state
  recorder = null;
  audioChunks = [];
  audioBlob = null;
  audioUrl = null;
  isRecording = false;
  recordingStartTime = null;
  
  // Stop timer
  stopRecordingTimer();
  
  // Cleanup audio context
  if (audioContext) {
    audioContext.close().catch(console.error);
    audioContext = null;
  }
  
  analyser = null;
  dataArray = null;
  
  // Cleanup audio element
  stopPlayback();
  
  // Revoke object URLs
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
};

/**
 * Cleanup all resources
 */
export const cleanupAll = (): void => {
  cleanupRecording();
  stopAudioVisualization();
};

// ============================================
// Voice Settings
// ============================================

/**
 * Default voice settings
 */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
  language: 'en-US',
  speed: 1.0,
  model: 'eleven_multilingual_v2',
};

/**
 * Available voices
 */
export const AVAILABLE_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', language: 'en-US' },
  { id: 'pNInz6obpgDQGcK2bQ3X', name: 'Adam', gender: 'male', language: 'en-US' },
  { id: 'AZnTlFQH7x4eBqzL2Cjt', name: 'Nicole', gender: 'female', language: 'en-US' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Matthew', gender: 'male', language: 'en-US' },
  { id: 'BxFyW2y2Yq54jX4p4H2N', name: 'Antoni', gender: 'male', language: 'en-US' },
  { id: 'ErXwobaYiN019PldhgYt', name: 'Elli', gender: 'female', language: 'en-US' },
  { id: 'Lcfu75Q8AQ5Qj3E03X3J', name: 'Michael', gender: 'male', language: 'en-US' },
  { id: 'MlY0JFQSS3zjx094x1Xk', name: 'Arthur', gender: 'male', language: 'en-GB' },
  { id: 'VF3x9QV2YQ6Q2DxKQ8kE', name: 'Lily', gender: 'female', language: 'en-GB' },
  { id: 'pMsXgVXv3BLzUgSXRplE', name: 'James', gender: 'male', language: 'en-GB' },
];

/**
 * Get voice by ID
 */
export const getVoiceById = (id: string) => {
  return AVAILABLE_VOICES.find((voice) => voice.id === id);
};

// ============================================
// Export
// ============================================

export default {
  // Recording
  initRecording,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  getRecordingStatus,
  getAudioBlob,
  getAudioUrl,
  getAudioDuration,
  
  // Playback
  playAudio,
  stopPlayback,
  pausePlayback,
  resumePlayback,
  getPlaybackStatus,
  seekAudio,
  
  // Visualization
  getAudioData,
  drawAudioVisualization,
  stopAudioVisualization,
  
  // Timer
  formatTime,
  
  // Devices
  getAudioInputDevices,
  getAudioOutputDevices,
  checkMicrophonePermission,
  requestMicrophonePermission,
  
  // Cleanup
  cleanupRecording,
  cleanupAll,
  
  // Settings
  DEFAULT_VOICE_SETTINGS,
  AVAILABLE_VOICES,
  getVoiceById,
};
