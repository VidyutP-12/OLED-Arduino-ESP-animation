import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Settings, Monitor, Smartphone, Code, Info, Zap, Clock, Memory } from 'lucide-react';

export interface Config {
  displaySize: string;
  orientation: string;
  library: string;
  targetFrames?: number;
}

// Board recommendations for different frame counts
export const BOARD_RECOMMENDATIONS = {
  '128x64': {
    low: { frames: '10-20', description: 'Basic Arduino Uno/Nano', memory: '~2KB', performance: 'Good' },
    medium: { frames: '20-50', description: 'Arduino Mega or ESP32', memory: '~5-10KB', performance: 'Better' },
    high: { frames: '50-100', description: 'ESP32 with PSRAM', memory: '~20KB', performance: 'Excellent' },
    max: { frames: '100+', description: 'High-end ESP32 or Raspberry Pi', memory: '~40KB+', performance: 'Premium' }
  },
  '96x64': {
    low: { frames: '15-30', description: 'Basic Arduino Uno/Nano', memory: '~1.5KB', performance: 'Good' },
    medium: { frames: '30-70', description: 'Arduino Mega or ESP32', memory: '~4-8KB', performance: 'Better' },
    high: { frames: '70-120', description: 'ESP32 with PSRAM', memory: '~15KB', performance: 'Excellent' },
    max: { frames: '120+', description: 'High-end ESP32 or Raspberry Pi', memory: '~30KB+', performance: 'Premium' }
  },
  '128x32': {
    low: { frames: '20-40', description: 'Basic Arduino Uno/Nano', memory: '~1KB', performance: 'Good' },
    medium: { frames: '40-100', description: 'Arduino Mega or ESP32', memory: '~2.5-5KB', performance: 'Better' },
    high: { frames: '100-200', description: 'ESP32 with PSRAM', memory: '~10KB', performance: 'Excellent' },
    max: { frames: '200+', description: 'High-end ESP32 or Raspberry Pi', memory: '~20KB+', performance: 'Premium' }
  },
  '64x48': {
    low: { frames: '30-60', description: 'Basic Arduino Uno/Nano', memory: '~0.5KB', performance: 'Good' },
    medium: { frames: '60-150', description: 'Arduino Mega or ESP32', memory: '~1.5-3KB', performance: 'Better' },
    high: { frames: '150-300', description: 'ESP32 with PSRAM', memory: '~6KB', performance: 'Excellent' },
    max: { frames: '300+', description: 'High-end ESP32 or Raspberry Pi', memory: '~12KB+', performance: 'Premium' }
  }
};

interface ConfigurationPanelProps {
  config: Config;
  onConfigChange: (config: Config) => void;
  maxFrames?: number; // Maximum frames available from the video
  onApplyChanges?: () => void; // Callback when user wants to apply changes
  hasVideo?: boolean; // Whether a video is currently uploaded
}

export const ConfigurationPanel = ({ config, onConfigChange, maxFrames, onApplyChanges, hasVideo }: ConfigurationPanelProps) => {
  const updateConfig = (key: keyof Config, value: string | number) => {
    onConfigChange({ ...config, [key]: value });
  };

  // Get board recommendations for current display size
  const getBoardRecommendation = (frameCount: number) => {
    const recommendations = BOARD_RECOMMENDATIONS[config.displaySize as keyof typeof BOARD_RECOMMENDATIONS];
    if (!recommendations) return null;
    
    if (frameCount <= 20) return recommendations.low;
    if (frameCount <= 50) return recommendations.medium;
    if (frameCount <= 100) return recommendations.high;
    return recommendations.max;
  };

  const currentRecommendation = getBoardRecommendation(config.targetFrames || (maxFrames || 50));
  const currentFrameCount = config.targetFrames || (maxFrames || 50);
  const estimatedMemory = Math.ceil((currentFrameCount * 128 * 64) / 8 / 1024); // Rough estimate in KB

  return (
    <Card className="p-6 bg-gradient-card border-tech-border">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">OLED Configuration</h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Display Size</Label>
            <Select value={config.displaySize} onValueChange={(value) => updateConfig('displaySize', value)}>
              <SelectTrigger className="bg-tech-surface border-tech-border">
                <SelectValue placeholder="Select display size" />
              </SelectTrigger>
              <SelectContent className="bg-tech-surface border-tech-border">
                <SelectItem value="128x64">128x64 (Most Common)</SelectItem>
                <SelectItem value="96x64">96x64</SelectItem>
                <SelectItem value="128x32">128x32</SelectItem>
                <SelectItem value="64x48">64x48</SelectItem>
                <SelectItem value="custom">Custom Size</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">Orientation</Label>
            <RadioGroup 
              value={config.orientation} 
              onValueChange={(value) => updateConfig('orientation', value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="horizontal" id="horizontal" className="border-tech-border" />
                <Label htmlFor="horizontal" className="flex items-center gap-2 cursor-pointer">
                  <Monitor className="w-4 h-4" />
                  Horizontal
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vertical" id="vertical" className="border-tech-border" />
                <Label htmlFor="vertical" className="flex items-center gap-2 cursor-pointer">
                  <Smartphone className="w-4 h-4" />
                  Vertical
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">Arduino Library</Label>
            <Select value={config.library} onValueChange={(value) => updateConfig('library', value)}>
              <SelectTrigger className="bg-tech-surface border-tech-border">
                <SelectValue placeholder="Select library" />
              </SelectTrigger>
              <SelectContent className="bg-tech-surface border-tech-border">
                <SelectItem value="adafruit_gfx_ssd1306">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Adafruit GFX + SSD1306
                  </div>
                </SelectItem>
                <SelectItem value="adafruit_gfx_ssd1331">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Adafruit GFX + SSD1331
                  </div>
                </SelectItem>
                <SelectItem value="u8g2">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    U8g2 Library
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Number of Frames</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {currentFrameCount} / {maxFrames || 50}
                </span>
                {hasVideo && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onApplyChanges}
                    className="h-6 px-2 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Apply
                  </Button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <Slider
                value={[currentFrameCount]}
                onValueChange={(value) => updateConfig('targetFrames', value[0])}
                max={maxFrames || 50}
                min={1}
                step={1}
                className="w-full"
              />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>1 frame</span>
                <span>{maxFrames || 50} frames</span>
              </div>

              {/* Frame count info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 p-2 bg-tech-surface rounded-lg">
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">{((currentFrameCount / 12) * 1000).toFixed(0)}ms</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-tech-surface rounded-lg">
                  <Memory className="w-3 h-3 text-green-500" />
                  <span className="text-muted-foreground">Memory:</span>
                  <span className="font-medium">~{estimatedMemory}KB</span>
                </div>
              </div>
            </div>
            
            {currentRecommendation && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-blue-600">Recommended Board</p>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-600 text-xs rounded-full">
                        {currentRecommendation.performance}
                      </span>
                    </div>
                    <p className="text-blue-500/80 mb-1">{currentRecommendation.description}</p>
                    <div className="flex items-center gap-4 text-blue-500/60 text-xs">
                      <span>Frames: {currentRecommendation.frames}</span>
                      <span>Memory: {currentRecommendation.memory}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {!hasVideo && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600 mb-1">Frame Setting Ready</p>
                    <p className="text-amber-500/80">
                      Set your desired frame count above, then upload a video to apply these settings.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-tech-surface rounded-lg p-4 border border-tech-border">
          <h4 className="font-medium mb-2 text-sm">Configuration Summary</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Display: {config.displaySize}</p>
            <p>• Orientation: {config.orientation}</p>
            <p>• Library: {config.library.replace(/_/g, ' ').toUpperCase()}</p>
            <p>• Target Frames: {currentFrameCount}</p>
            {maxFrames && maxFrames > 0 && (
              <p>• Available: {maxFrames} frames</p>
            )}
            <p>• Estimated Memory: ~{estimatedMemory}KB</p>
          </div>
        </div>
      </div>
    </Card>
  );
};