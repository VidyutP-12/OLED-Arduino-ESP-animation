import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    // Scale up for visibility
    const scale = Math.max(2, Math.floor(256 / Math.max(width, height)));
    canvas.width = width * scale;
    canvas.height = height * scale;

    const drawFrame = (frameIdx: number) => {
      if (frameIdx < 0 || frameIdx >= framesMono.length) return;
      
      const bits = framesMono[frameIdx];
      const imageData = ctx.createImageData(width, height);
      for (let i = 0; i < bits.length; i++) {
        const on = bits[i] ? 255 : 0;
        imageData.data[i * 4 + 0] = on;
        imageData.data[i * 4 + 1] = on;
        imageData.data[i * 4 + 2] = on;
        imageData.data[i * 4 + 3] = 255;
      }
      // Draw with nearest-neighbor scaling
      const off = new OffscreenCanvas(width, height);
      const offCtx = off.getContext('2d');
      offCtx?.putImageData(imageData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(off as any, 0, 0, canvas.width, canvas.height);
    };

    let acc = 0;
    const frameDuration = 1000 / Math.max(1, fps);

    const loop = (time: number) => {
      if (lastTimeRef.current == null) lastTimeRef.current = time;
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;
      acc += dt;
      if (acc >= frameDuration) {
        acc -= frameDuration;
        drawFrame(frameRef.current);
        frameRef.current = (frameRef.current + 1) % framesMono.length;
      }
      if (playing && framesMono.length) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    if (playing && framesMono.length) {
      drawFrame(frameRef.current);
      rafRef.current = requestAnimationFrame(loop);
    } else if (!playing && framesMono.length) {
      // When not playing, show the current frame
      drawFrame(currentFrame);
      frameRef.current = currentFrame;
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = null;
    };
  }, [framesMono, width, height, fps, playing, currentFrame]);

  // Update display when currentFrame changes (manual navigation)
  useEffect(() => {
    if (!playing && framesMono.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) return;

      // Scale up for visibility
      const scale = Math.max(2, Math.floor(256 / Math.max(width, height)));
      canvas.width = width * scale;
      canvas.height = height * scale;

      const drawFrame = (frameIdx: number) => {
        if (frameIdx < 0 || frameIdx >= framesMono.length) return;
        
        const bits = framesMono[frameIdx];
        const imageData = ctx.createImageData(width, height);
        for (let i = 0; i < bits.length; i++) {
          const on = bits[i] ? 255 : 0;
          imageData.data[i * 4 + 0] = on;
          imageData.data[i * 4 + 1] = on;
          imageData.data[i * 4 + 2] = on;
          imageData.data[i * 4 + 3] = 255;
        }
        // Draw with nearest-neighbor scaling
        const off = new OffscreenCanvas(width, height);
        const offCtx = off.getContext('2d');
        offCtx?.putImageData(imageData, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(off as any, 0, 0, canvas.width, canvas.height);
      };

      drawFrame(currentFrame);
    }
  }, [currentFrame, framesMono, width, height, playing]);

  return (
    <canvas ref={canvasRef} className="rounded border border-tech-border bg-black" aria-label="OLED preview canvas" />
  );
};
