import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { VideoUploader } from '@/components/VideoUploader';
import { ConfigurationPanel, Config } from '@/components/ConfigurationPanel';
import { PreviewSection } from '@/components/PreviewSection';
import { CodeOutput } from '@/components/CodeOutput';
import { Play, ArrowRight, Zap, Monitor, Code, Download } from 'lucide-react';
import heroImage from '@/assets/hero-image.jpg';
import { processVideo, generateArduinoCode } from '@/utils/videoProcessing';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_FPS = 12;
const MAX_FRAMES = 300;

const Index = () => {
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [config, setConfig] = useState<Config>({
    displaySize: '128x64',
    orientation: 'horizontal',
    library: 'adafruit_gfx_ssd1306',
    targetFrames: 20 // Default to 20 frames
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const [framesMono, setFramesMono] = useState<Uint8Array[]>([]);
  const [framesPacked, setFramesPacked] = useState<Uint8Array[]>([]);
  const [oledW, setOledW] = useState(128);
  const [oledH, setOledH] = useState(64);
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [duration, setDuration] = useState(0);
  const [maxFrames, setMaxFrames] = useState(0);

  const { toast } = useToast();

  const parseSize = (s: string): { w: number; h: number } => {
    if (s === 'custom') return { w: 128, h: 64 };
    const [w, h] = s.split('x').map((n) => parseInt(n, 10));
    return { w: w || 128, h: h || 64 };
  };

  const handleVideoSelect = (file: File | null) => {
    setSelectedVideo(file);
    setGeneratedCode(null);
    setMaxFrames(0);
    // Keep the current targetFrames setting when new video is selected
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedVideo) {
        setFramesMono([]);
        setFramesPacked([]);
        setGeneratedCode(null);
        setMaxFrames(0);
        return;
      }
      setIsProcessing(true);
      try {
        const { w, h } = parseSize(config.displaySize);
        const res = await processVideo(selectedVideo, {
          width: w,
          height: h,
          orientation: config.orientation as any,
          targetFps: DEFAULT_FPS,
          maxFrames: MAX_FRAMES,
          targetFrames: config.targetFrames || 20, // Use config value or default to 20
          threshold: 128,
        });
        if (cancelled) return;
        setFramesMono(res.framesMono);
        setFramesPacked(res.framesPacked);
        setOledW(res.width);
        setOledH(res.height);
        setFps(res.fps);
        setDuration(res.duration);
        
        // Calculate max frames based on video duration and target FPS
        const calculatedMaxFrames = Math.floor(res.duration * DEFAULT_FPS);
        setMaxFrames(calculatedMaxFrames);
        
        // Automatically generate Arduino code after video processing
        if (res.framesPacked.length > 0) {
          try {
            console.log('Auto-generating Arduino code for', res.framesPacked.length, 'frames');
            const code = generateArduinoCode(
              res.framesPacked,
              res.width,
              res.height,
              res.fps,
              config.library as any
            );
            if (!cancelled) {
              setGeneratedCode(code);
              console.log('Auto-generated Arduino code successfully, length:', code.length);
            }
          } catch (e: any) {
            console.error('Auto code generation failed:', e);
            // Don't show error toast for auto-generation, just log it
          }
        }
        
        toast({
          title: 'Video processed',
          description: `${res.framesMono.length} frames @ ${Math.round(res.fps)} FPS (${res.width}x${res.height})${config.targetFrames ? ` (requested: ${config.targetFrames})` : ''}`,
        });
      } catch (e: any) {
        console.error(e);
        toast({ title: 'Processing failed', description: e?.message || 'Could not process video' });
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [selectedVideo, config.displaySize, config.orientation, config.library]);

  // Regenerate code when library changes (if we already have frames)
  useEffect(() => {
    if (framesPacked.length > 0 && !isProcessing) {
      setIsRegenerating(true);
      // Small delay to make the regeneration visible
      setTimeout(() => {
        try {
          console.log('Regenerating code due to library change:', { 
            library: config.library, 
            frameCount: framesPacked.length
          });
          const code = generateArduinoCode(
            framesPacked,
            oledW,
            oledH,
            fps,
            config.library as any
          );
          setGeneratedCode(code);
          console.log('Regenerated Arduino code successfully, length:', code.length);
        } catch (e: any) {
          console.error('Code regeneration failed:', e);
        } finally {
          setIsRegenerating(false);
        }
      }, 100);
    }
  }, [config.library, framesPacked.length, oledW, oledH, fps, isProcessing]);

  const handleGenerateCode = async () => {
    if (!framesPacked.length) {
      toast({ title: 'No frames to generate', description: 'Upload a video first' });
      return;
    }
    
    console.log('Regenerating Arduino code with:', {
      frameCount: framesPacked.length,
      width: oledW,
      height: oledH,
      fps: fps,
      library: config.library,
      firstFrameSize: framesPacked[0]?.length,
      sampleBytes: framesPacked[0]?.slice(0, 8)
    });
    
    setIsGenerating(true);
    try {
      const code = generateArduinoCode(
        framesPacked,
        oledW,
        oledH,
        fps,
        config.library as any
      );
      console.log('Generated code length:', code.length);
      setGeneratedCode(code);
      toast({ 
        title: 'Arduino code updated', 
        description: `Regenerated ${framesPacked.length} frames (${Math.round(code.length / 1024)}KB code)` 
      });
    } catch (e: any) {
      console.error('Code generation error:', e);
      toast({ title: 'Generation failed', description: e?.message || 'Could not generate code' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyFrameChanges = async () => {
    if (!selectedVideo) {
      toast({ title: 'No video uploaded', description: 'Upload a video first' });
      return;
    }
    
    setIsProcessing(true);
    try {
      const { w, h } = parseSize(config.displaySize);
      const res = await processVideo(selectedVideo, {
        width: w,
        height: h,
        orientation: config.orientation as any,
        targetFps: DEFAULT_FPS,
        maxFrames: MAX_FRAMES,
        targetFrames: config.targetFrames,
        threshold: 128,
      });
      
      setFramesMono(res.framesMono);
      setFramesPacked(res.framesPacked);
      setOledW(res.width);
      setOledH(res.height);
      setFps(res.fps);
      setDuration(res.duration);
      
      // Update max frames
      const calculatedMaxFrames = Math.floor(res.duration * DEFAULT_FPS);
      setMaxFrames(calculatedMaxFrames);
      
      // Generate new code with updated frames
      if (res.framesPacked.length > 0) {
        const code = generateArduinoCode(
          res.framesPacked,
          res.width,
          res.height,
          res.fps,
          config.library as any
        );
        setGeneratedCode(code);
      }
      
      toast({
        title: 'Frame changes applied',
        description: `${res.framesMono.length} frames @ ${Math.round(res.fps)} FPS (${res.width}x${res.height})`,
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Processing failed', description: e?.message || 'Could not apply frame changes' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfigChange = (newConfig: Config) => {
    setConfig(newConfig);
    setGeneratedCode(null); // Clear generated code if config changes
    setMaxFrames(0); // Reset max frames
  };

  const handleFrameCountChange = async (targetFrames: number) => {
    if (!selectedVideo) {
      toast({ title: 'No video uploaded', description: 'Upload a video first' });
      return;
    }
    setConfig(prev => ({ ...prev, targetFrames }));
    setGeneratedCode(null); // Clear generated code if targetFrames changes
    setMaxFrames(0); // Reset max frames
    setIsProcessing(true);
    try {
      const { w, h } = parseSize(config.displaySize);
      const res = await processVideo(selectedVideo, {
        width: w,
        height: h,
        orientation: config.orientation as any,
        targetFps: DEFAULT_FPS,
        maxFrames: MAX_FRAMES,
        targetFrames: targetFrames,
        threshold: 128,
      });
      setFramesMono(res.framesMono);
      setFramesPacked(res.framesPacked);
      setOledW(res.width);
      setOledH(res.height);
      setFps(res.fps);
      setDuration(res.duration);
      const calculatedMaxFrames = Math.floor(res.duration * DEFAULT_FPS);
      setMaxFrames(calculatedMaxFrames);
      if (res.framesPacked.length > 0) {
        const code = generateArduinoCode(
          res.framesPacked,
          res.width,
          res.height,
          res.fps,
          config.library as any
        );
        setGeneratedCode(code);
      }
      toast({
        title: 'Frame count applied',
        description: `${res.framesMono.length} frames @ ${Math.round(res.fps)} FPS (${res.width}x${res.height})`,
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Processing failed', description: e?.message || 'Could not apply frame count' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b border-tech-border bg-tech-surface/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Play className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">Video to Arduino OLED</h1>
            </div>
            <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              <Code className="w-4 h-4 mr-2" />
              View Docs
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              Convert Videos to Arduino OLED Code
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Transform any short video into ready-to-use Arduino code for OLED displays. 
              Support for multiple libraries and display sizes.
            </p>
            
            <div className="relative max-w-3xl mx-auto mb-12">
              <img 
                src={heroImage} 
                alt="Video to Arduino conversion"
                className="rounded-2xl shadow-card animate-float"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-primary/20 rounded-2xl"></div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span>Fast Processing</span>
              </div>
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                <span>Multiple Display Sizes</span>
              </div>
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-primary" />
                <span>Ready-to-Use Code</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                <span>Instant Download</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Application */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
            {/* Left Column */}
            <div className="space-y-6">
              <VideoUploader 
                onVideoSelect={handleVideoSelect}
                selectedVideo={selectedVideo}
              />
              
              <ConfigurationPanel 
                config={config}
                onConfigChange={handleConfigChange}
                maxFrames={maxFrames}
                onApplyChanges={() => handleFrameCountChange(config.targetFrames || 20)}
                hasVideo={!!selectedVideo}
              />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <PreviewSection 
                isProcessing={isProcessing}
                hasVideo={!!selectedVideo}
                framesMono={framesMono}
                width={oledW}
                height={oledH}
                fps={fps}
                onGenerateCode={handleGenerateCode}
              />
              
              <CodeOutput 
                generatedCode={generatedCode}
                isGenerating={isGenerating}
                isRegenerating={isRegenerating}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-20 px-4 bg-tech-surface/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our processing pipeline converts your video into optimized Arduino code.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[{ icon: Play, title: 'Upload Video', desc: 'Select your video file (MP4, AVI, MOV, MKV)' },
              { icon: Monitor, title: 'Configure Display', desc: 'Choose OLED size, orientation, and library' },
              { icon: Zap, title: 'Process Frames', desc: 'Convert to monochrome and optimize for Arduino' },
              { icon: Download, title: 'Download Code', desc: 'Get ready-to-use .ino file' }
            ].map((step, index) => (
              <Card key={index} className="p-6 text-center bg-gradient-card border-tech-border">
                <div className="p-3 bg-primary/10 rounded-xl w-fit mx-auto mb-4">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
                {index < 3 && (
                  <ArrowRight className="w-5 h-5 text-primary mx-auto mt-4 opacity-50" />
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-tech-border bg-tech-surface/50 py-8 px-4">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground">
            Built for makers, by makers. Convert your videos to Arduino OLED displays with ease.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
