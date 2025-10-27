import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Eye, Play, Pause, FileCode, SkipBack, SkipForward, RotateCcw, Info, Zap, Clock, HardDrive, Monitor } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { OLEDPreview } from './OLEDPreview';

interface PreviewSectionProps {
  isProcessing: boolean;
  hasVideo: boolean;
  framesMono: Uint8Array[];
  width: number;
  height: number;
  fps: number;
  onGenerateCode: () => void;
}

export const PreviewSection = memo(({ isProcessing, hasVideo, framesMono, width, height, fps, onGenerateCode }: PreviewSectionProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const canPreview = hasVideo && framesMono.length > 0;
  const totalFrames = framesMono.length;
  
  // Memoize calculations to prevent unnecessary recalculations
  const frameDuration = useMemo(() => 1000 / fps, [fps]);
  const progressPercentage = useMemo(() => 
    totalFrames > 0 ? (currentFrame / (totalFrames - 1)) * 100 : 0, 
    [currentFrame, totalFrames]
  );
  
  const estimatedMemory = useMemo(() => 
    Math.ceil((totalFrames * width * height) / 8 / 1024), 
    [totalFrames, width, height]
  );

  // Optimized frame change handler
  const handleFrameChange = useCallback((newFrame: number) => {
    const clampedFrame = Math.max(0, Math.min(newFrame, totalFrames - 1));
    setCurrentFrame(clampedFrame);
  }, [totalFrames]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
  }, []);

  const handleSpeedChange = useCallback(() => {
    const speeds = [0.25, 0.5, 1, 2, 4, 8];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  }, [playbackSpeed]);

  const formatTime = useCallback((frameIndex: number) => {
    const seconds = frameIndex / fps;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, [fps]);

  // Reset to first frame when frames change
  useEffect(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
  }, [framesMono.length]);

  // Handle keyboard shortcuts with stable references
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!canPreview) return;
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleFrameChange(currentFrame - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleFrameChange(currentFrame + 1);
          break;
        case 'Home':
          e.preventDefault();
          handleReset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [canPreview, currentFrame, handlePlayPause, handleFrameChange, handleReset]);

  return (
    <Card className="p-6 bg-gradient-card border-tech-border">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Preview & Generate</h3>
          </div>
          {isProcessing && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              Processing...
            </Badge>
          )}
        </div>

        {!canPreview ? (
          <div className="bg-tech-surface rounded-xl p-8 text-center border border-tech-border">
            <div className="w-16 h-16 bg-gradient-primary/10 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <Eye className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground mb-2">
              {isProcessing ? 'Extracting frames and preparing preview...' : 'Upload a video to see the preview'}
            </p>
            {isProcessing && (
              <div className="mt-4">
                <Progress value={33} className="w-full max-w-xs mx-auto" />
                <p className="text-xs text-muted-foreground mt-2">Processing video frames...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Enhanced Frame Information */}
            <div className="bg-gradient-to-r from-tech-surface to-tech-surface/50 rounded-lg p-4 border border-tech-border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-500" />
                  <span className="text-muted-foreground">Frame:</span>
                  <span className="font-medium">{currentFrame + 1} / {totalFrames}</span>
                  {totalFrames > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({Math.round((currentFrame / totalFrames) * 100)}%)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">{formatTime(currentFrame)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <span className="text-muted-foreground">Speed:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSpeedChange}
                    className="h-6 px-2 text-xs hover:bg-primary/10"
                  >
                    {playbackSpeed}x
                  </Button>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            </div>

            {/* Enhanced OLED Preview */}
            <div className="bg-gradient-to-br from-black to-gray-900 rounded-xl p-4 border border-tech-border shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-white">
                      OLED Preview ({width}×{height})
                    </span>
                  </div>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                    {Math.round(fps)} FPS
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-gray-400 hover:text-white hover:bg-white/10"
                    title="Reset to first frame (Home key)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePlayPause}
                    className="text-white hover:bg-white/10"
                    title="Play/Pause (Space key)"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center mb-4">
                <OLEDPreview 
                  framesMono={framesMono} 
                  width={width} 
                  height={height} 
                  fps={fps} 
                  playing={isPlaying}
                  currentFrame={currentFrame}
                />
              </div>

              {/* Enhanced Frame Navigation */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFrameChange(currentFrame - 1)}
                    disabled={currentFrame === 0}
                    className="text-gray-400 hover:text-white hover:bg-white/10"
                    title="Previous frame (← key)"
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex-1 relative">
                    <input
                      type="range"
                      min="0"
                      max={totalFrames - 1}
                      value={currentFrame}
                      onChange={(e) => handleFrameChange(parseInt(e.target.value))}
                      onMouseDown={() => setIsDragging(true)}
                      onMouseUp={() => setIsDragging(false)}
                      onTouchStart={() => setIsDragging(true)}
                      onTouchEnd={() => setIsDragging(false)}
                      className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progressPercentage}%, #374151 ${progressPercentage}%, #374151 100%)`
                      }}
                    />
                    <div className="absolute -top-6 left-0 right-0 flex justify-between text-xs text-gray-400">
                      <span>0:00</span>
                      <span>{formatTime(totalFrames - 1)}</span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFrameChange(currentFrame + 1)}
                    disabled={currentFrame === totalFrames - 1}
                    className="text-gray-400 hover:text-white hover:bg-white/10"
                    title="Next frame (→ key)"
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Keyboard shortcuts hint */}
                <div className="text-xs text-gray-500 text-center">
                  <span>Use Space to play/pause, ← → to navigate, Home to reset</span>
                </div>
              </div>
            </div>

            {/* Enhanced Frame Statistics */}
            <div className="bg-gradient-to-r from-tech-surface to-tech-surface/50 rounded-lg p-4 border border-tech-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Duration</span>
                    <span className="font-medium">{formatTime(totalFrames - 1)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Frame Rate</span>
                    <span className="font-medium">{Math.round(fps)} FPS</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-purple-500" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Resolution</span>
                    <span className="font-medium">{width}×{height}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-orange-500" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Memory</span>
                    <span className="font-medium">~{estimatedMemory}KB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Generate Button */}
            <Button 
              onClick={onGenerateCode}
              disabled={isProcessing}
              className="w-full bg-gradient-primary hover:shadow-electric transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              size="lg"
            >
              <FileCode className="w-5 h-5 mr-2" />
              {isProcessing ? 'Processing...' : 'Generate Arduino Code'}
              {!isProcessing && (
                <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                  {totalFrames} frames
                </Badge>
              )}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
});

PreviewSection.displayName = 'PreviewSection';
