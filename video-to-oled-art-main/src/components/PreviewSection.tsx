import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Play, Pause, FileCode, SkipBack, SkipForward, RotateCcw, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
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

export const PreviewSection = ({ isProcessing, hasVideo, framesMono, width, height, fps, onGenerateCode }: PreviewSectionProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const canPreview = hasVideo && framesMono.length > 0;
  const totalFrames = framesMono.length;
  const frameDuration = 1000 / fps; // ms per frame

  // Auto-advance frames when playing
  useEffect(() => {
    if (!isPlaying || !canPreview) return;

    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % totalFrames);
    }, frameDuration / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, canPreview, totalFrames, frameDuration, playbackSpeed]);

  // Reset to first frame when frames change
  useEffect(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
  }, [framesMono.length]);

  const handleFrameChange = (newFrame: number) => {
    setCurrentFrame(Math.max(0, Math.min(newFrame, totalFrames - 1)));
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentFrame(0);
    setIsPlaying(false);
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 1, 2, 4];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  };

  const formatTime = (frameIndex: number) => {
    const seconds = (frameIndex / fps);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

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
            <div className="w-16 h-16 bg-muted-foreground/10 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <Eye className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              {isProcessing ? 'Extracting frames and preparing preview...' : 'Upload a video to see the preview'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Frame Information */}
            <div className="bg-tech-surface rounded-lg p-3 border border-tech-border">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">Frame:</span>
                  <span className="font-medium">{currentFrame + 1} / {totalFrames}</span>
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">{formatTime(currentFrame)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Speed:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSpeedChange}
                    className="h-6 px-2 text-xs"
                  >
                    {playbackSpeed}x
                  </Button>
                </div>
              </div>
            </div>

            {/* OLED Preview */}
            <div className="bg-black rounded-xl p-4 border border-tech-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">
                  OLED Preview ({width}x{height}) @ {Math.round(fps)} FPS
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-muted-foreground hover:text-primary"
                    title="Reset to first frame"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePlayPause}
                    className="text-primary hover:bg-primary/10"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center mb-3">
                <OLEDPreview 
                  framesMono={framesMono} 
                  width={width} 
                  height={height} 
                  fps={fps} 
                  playing={isPlaying}
                  currentFrame={currentFrame}
                />
              </div>

              {/* Frame Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFrameChange(currentFrame - 1)}
                  disabled={currentFrame === 0}
                  className="text-muted-foreground hover:text-primary"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                
                <div className="flex-1 mx-2">
                  <input
                    type="range"
                    min="0"
                    max={totalFrames - 1}
                    value={currentFrame}
                    onChange={(e) => handleFrameChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-tech-border rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(currentFrame / (totalFrames - 1)) * 100}%, var(--tech-border) ${(currentFrame / (totalFrames - 1)) * 100}%, var(--tech-border) 100%)`
                    }}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFrameChange(currentFrame + 1)}
                  disabled={currentFrame === totalFrames - 1}
                  className="text-muted-foreground hover:text-primary"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Frame Statistics */}
            <div className="bg-tech-surface rounded-lg p-3 border border-tech-border">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span className="text-muted-foreground">Total Duration:</span>
                  <span className="font-medium">{formatTime(totalFrames - 1)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">Frame Rate:</span>
                  <span className="font-medium">{Math.round(fps)} FPS</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-500" />
                  <span className="text-muted-foreground">Resolution:</span>
                  <span className="font-medium">{width}×{height}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-orange-500" />
                  <span className="text-muted-foreground">Memory:</span>
                  <span className="font-medium">~{Math.ceil((totalFrames * width * height) / 8 / 1024)}KB</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={onGenerateCode}
              disabled={isProcessing}
              className="w-full bg-gradient-primary hover:shadow-electric transition-all duration-300"
              size="lg"
            >
              <FileCode className="w-5 h-5 mr-2" />
              Regenerate Arduino Code
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
