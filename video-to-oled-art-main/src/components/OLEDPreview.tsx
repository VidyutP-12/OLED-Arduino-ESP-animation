import { useEffect, useRef, useCallback, useMemo } from 'react';

interface OLEDPreviewProps {
  framesMono: Uint8Array[]; // 0/1 per pixel
  width: number;
  height: number;
  fps: number;
  playing: boolean;
  currentFrame?: number; // New prop for manual frame selection
}

export const OLEDPreview = ({ framesMono, width, height, fps, playing, currentFrame = 0 }: OLEDPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const imageDataCache = useRef<Map<number, ImageData>>(new Map());

  // Memoize scale calculation to prevent unnecessary recalculations
  const scale = useMemo(() => Math.max(2, Math.floor(256 / Math.max(width, height))), [width, height]);
  
  // Memoize frame duration to prevent recalculation
  const frameDuration = useMemo(() => 1000 / Math.max(1, fps), [fps]);

  // Optimized frame drawing with caching
  const drawFrame = useCallback((frameIdx: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx || frameIdx < 0 || frameIdx >= framesMono.length) return;

    // Check cache first
    let imageData = imageDataCache.current.get(frameIdx);
    if (!imageData) {
      const bits = framesMono[frameIdx];
      imageData = ctx.createImageData(width, height);
      
      // Optimized pixel setting
      for (let i = 0; i < bits.length; i++) {
        const pixelValue = bits[i] ? 255 : 0;
        const pixelIndex = i * 4;
        imageData.data[pixelIndex] = pixelValue;     // R
        imageData.data[pixelIndex + 1] = pixelValue; // G
        imageData.data[pixelIndex + 2] = pixelValue; // B
        imageData.data[pixelIndex + 3] = 255;        // A
      }
      
      // Cache the image data
      imageDataCache.current.set(frameIdx, imageData);
    }

    // Use OffscreenCanvas for better performance
    const offscreen = new OffscreenCanvas(width, height);
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imageData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    }
  }, [framesMono, width, height]);

  // Animation loop with better performance and frame skipping
  const animationLoop = useCallback((time: number) => {
    if (lastTimeRef.current == null) {
      lastTimeRef.current = time;
      drawFrame(frameRef.current);
    } else {
      const dt = time - lastTimeRef.current;
      
      // Use accumulator for more accurate timing
      if (dt >= frameDuration) {
        frameRef.current = (frameRef.current + 1) % framesMono.length;
        drawFrame(frameRef.current);
        lastTimeRef.current = time;
      }
    }
    
    if (playing && framesMono.length > 0) {
      rafRef.current = requestAnimationFrame(animationLoop);
    }
  }, [playing, framesMono.length, frameDuration, drawFrame]);

  // Setup canvas and animation
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx || framesMono.length === 0) return;

    // Set canvas size
    canvas.width = width * scale;
    canvas.height = height * scale;

    // Clear cache when frames change
    imageDataCache.current.clear();

    if (playing && framesMono.length > 0) {
      // Start animation
      frameRef.current = 0;
      lastTimeRef.current = null;
      drawFrame(0);
      rafRef.current = requestAnimationFrame(animationLoop);
    } else {
      // Show current frame when not playing
      drawFrame(currentFrame);
      frameRef.current = currentFrame;
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [framesMono, width, height, fps, playing, currentFrame, scale, drawFrame, animationLoop]);

  // Handle manual frame changes when not playing
  useEffect(() => {
    if (!playing && framesMono.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) return;

      // Ensure canvas is properly sized
      canvas.width = width * scale;
      canvas.height = height * scale;
      
      drawFrame(currentFrame);
      frameRef.current = currentFrame;
    }
  }, [currentFrame, playing, framesMono.length, width, height, scale, drawFrame]);


  return (
    <div className="relative">
      <canvas 
        ref={canvasRef} 
        className="rounded border border-tech-border bg-black shadow-lg" 
        aria-label="OLED preview canvas"
        style={{ 
          minWidth: `${width * scale}px`,
          minHeight: `${height * scale}px`,
          maxWidth: '100%',
          height: 'auto'
        }}
      />
      {framesMono.length > 0 && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {width}×{height}
        </div>
      )}
    </div>
  );
};
