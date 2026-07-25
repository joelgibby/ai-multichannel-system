// AI Multichannel System - File Upload Component
import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image, AudioLines, Video, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface FilePreview {
  file: File;
  url: string;
  type: 'image' | 'audio' | 'video' | 'document';
  status: 'uploading' | 'complete' | 'error';
  progress: number;
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="w-5 h-5" />,
  audio: <AudioLines className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
};

const getFileType = (file: File): 'image' | 'audio' | 'video' | 'document' => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = 'audio/*,image/*,video/*,.pdf,.txt,.doc,.docx',
  multiple = false,
  disabled = false,
  className,
  children,
}) => {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      if (!multiple) {
        // Only take the first file
        processFiles([newFiles[0]]);
      } else {
        processFiles(newFiles);
      }
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [multiple]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      if (!multiple) {
        processFiles([newFiles[0]]);
      } else {
        processFiles(newFiles);
      }
    }
  }, [multiple]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = (fileList: File[]) => {
    const newPreviews: FilePreview[] = fileList.map(file => ({
      file,
      url: URL.createObjectURL(file),
      type: getFileType(file),
      status: 'uploading',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newPreviews]);

    // Simulate upload progress
    newPreviews.forEach((preview, index) => {
      const interval = setInterval(() => {
        setFiles(prev => prev.map((f, i) => {
          if (i === prev.length - newPreviews.length + index) {
            const newProgress = f.progress + 10;
            if (newProgress >= 100) {
              clearInterval(interval);
              // Mark as complete and trigger callback
              setTimeout(() => {
                setFiles(prev2 => prev2.map((f2, i2) => 
                  i2 === i ? { ...f2, status: 'complete' } : f2
                ));
                onFileSelect(f.file);
              }, 200);
              return { ...f, progress: 100 };
            }
            return { ...f, progress: newProgress };
          }
          return f;
        }));
      }, 100);
    });
  };

  const handleRemoveFile = (index: number) => {
    const fileToRemove = files[index];
    URL.revokeObjectURL(fileToRemove.url);
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const hasFiles = files.length > 0;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
      />

      {/* Drop zone */}
      <div
        className={cn(
          `
            relative flex flex-col items-center justify-center border-2 border-dashed
            rounded-lg p-6 transition-all duration-200 cursor-pointer
            bg-background hover:bg-muted/50
          `,
          isDragging ? 'border-primary bg-primary/5 border-solid' : 'border-muted',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          hasFiles ? 'min-h-[100px]' : 'min-h-[150px]'
        )}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(e) => e.preventDefault()}
      >
        {hasFiles ? (
          <div className="w-full space-y-3">
            {files.map((preview, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <div className={cn(
                  'p-2 rounded-lg',
                  preview.status === 'uploading' ? 'bg-primary/10' :
                  preview.status === 'complete' ? 'bg-green-500/10' :
                  'bg-destructive/10'
                )}>
                  {FILE_TYPE_ICONS[preview.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {preview.file.name}
                    </span>
                    {preview.status === 'complete' && (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    )}
                    {preview.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(preview.file.size)}</span>
                    {preview.status === 'uploading' && (
                      <span>{preview.progress}%</span>
                    )}
                  </div>
                  {/* Progress bar */}
                  {preview.status === 'uploading' && (
                    <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${preview.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <button
                  className="p-1 rounded-lg hover:bg-destructive/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                >
                  <X className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              {isDragging ? (
                <Upload className="w-6 h-6 text-primary" />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragging ? 'Drop files here' : 'Upload files'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isDragging ? 'Supports: images, audio, video, documents' : 'Drag & drop or click to browse'}
              </p>
            </div>
          </>
        )}

        {/* Overlay for disabled state */}
        {disabled && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-lg" />
        )}
      </div>

      {/* Custom children */}
      {children && (
        <div onClick={handleClick}>
          {children}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
