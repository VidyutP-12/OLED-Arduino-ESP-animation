export type Orientation = 'horizontal' | 'vertical';

export interface ProcessOptions {
  width: number;
  height: number;
  orientation: Orientation;
  targetFps: number; // desired fps (10-20)
  maxFrames: number; // cap frames to avoid memory issues
  targetFrames?: number; // specific number of frames to extract
  threshold?: number; // 0-255
}

export interface ProcessResult {
  framesMono: Uint8Array[]; // 1 = white(pixel on), 0 = black for each pixel, length width*height
  framesPacked: Uint8Array[]; // packed bytes (row-major, 8 pixels per byte)
  width: number;
  height: number;
  fps: number;
  duration: number;
}

function waitEvent<T extends keyof HTMLVideoElementEventMap>(el: HTMLVideoElement, event: T): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      el.removeEventListener(event, handler as any);
      resolve();
    };
    el.addEventListener(event, handler as any, { once: true });
  });
}

function grayscaleAndThreshold(data: Uint8ClampedArray, threshold: number): Uint8Array {
  const result = new Uint8Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // luminance
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    result[j] = y >= threshold ? 1 : 0;
  }
  return result;
}

function packRowMajor(bits: Uint8Array, width: number, height: number): Uint8Array {
  const bytesPerRow = Math.ceil(width / 8);
  const out = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = bits[y * width + x];
      const byteIndex = y * bytesPerRow + (x >> 3);
      const bitPos = x & 7; // LSB is leftmost
      if (bit) out[byteIndex] |= (1 << bitPos);
    }
  }
  return out;
}

export async function processVideo(file: File, opts: ProcessOptions): Promise<ProcessResult> {
  let videoUrl: string | null = null;
  
  try {
    // Setup video element
    videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    // Wait for video to load
    await waitEvent(video, 'loadedmetadata');
    
    if (!video.duration || isNaN(video.duration)) {
      throw new Error('Invalid video duration');
    }
    
    const duration = Math.min(video.duration, 30);

    const targetFps = Math.max(1, Math.min(30, opts.targetFps));
    
    // Calculate frames based on targetFrames if specified, otherwise use duration
    let totalDesired: number;
    if (opts.targetFrames && opts.targetFrames > 0) {
      totalDesired = Math.min(opts.maxFrames, opts.targetFrames);
    } else {
      totalDesired = Math.min(opts.maxFrames, Math.floor(duration * targetFps));
    }
    
    const fps = totalDesired > 0 ? Math.min(targetFps, totalDesired / duration) : targetFps;

    const timestamps: number[] = [];
    const step = 1 / fps;
    
    // Generate timestamps for frame extraction
    for (let t = 0; t < duration && timestamps.length < totalDesired; t += step) {
      timestamps.push(t);
    }

    // Ensure we have at least one frame
    if (timestamps.length === 0) {
      timestamps.push(0);
    }

    const width = opts.orientation === 'horizontal' ? opts.width : opts.height;
    const height = opts.orientation === 'horizontal' ? opts.height : opts.width;

    // Validate dimensions
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid display dimensions');
    }

    // Canvases
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas context not available');

    canvas.width = width;
    canvas.height = height;

    const framesMono: Uint8Array[] = [];
    const framesPacked: Uint8Array[] = [];
    const threshold = opts.threshold ?? 128;

    // Extract frames
    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      try {
        // Seek to timestamp
        if ('fastSeek' in video && typeof (video as any).fastSeek === 'function') {
          (video as any).fastSeek(t);
        } else {
          video.currentTime = Math.min(t, duration);
        }
        
        await waitEvent(video, 'seeked');

        // Draw frame to canvas with optional rotation
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (opts.orientation === 'vertical') {
          // rotate 90deg CW
          ctx.translate(canvas.width, 0);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(video, 0, 0, canvas.height, canvas.width);
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const mono = grayscaleAndThreshold(imageData.data, threshold);
        framesMono.push(mono);
        framesPacked.push(packRowMajor(mono, canvas.width, canvas.height));
      } catch (e) {
        console.warn('Skipping frame at', t, e);
        // Continue with next frame instead of failing completely
      }
    }

    // Ensure we have at least one frame
    if (framesMono.length === 0) {
      throw new Error('No frames could be extracted from video');
    }

    return { 
      framesMono, 
      framesPacked, 
      width, 
      height, 
      fps, 
      duration 
    };
    
  } catch (error) {
    console.error('Video processing error:', error);
    throw new Error(`Failed to process video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Clean up video URL to prevent memory leaks
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
  }
}

export function generateArduinoCode(framesPacked: Uint8Array[], width: number, height: number, fps: number, library: 'adafruit_gfx_ssd1306' | 'adafruit_gfx_ssd1331' | 'u8g2') {
  console.log('generateArduinoCode called with:', { 
    frameCount: framesPacked.length, 
    width, 
    height, 
    fps, 
    library,
    firstFrameSize: framesPacked[0]?.length 
  });

  if (!framesPacked || framesPacked.length === 0) {
    throw new Error('No frame data provided');
  }

  const frameDelay = Math.max(1, Math.round(1000 / fps));
  const bytesPerFrame = Math.ceil(width * height / 8);
  
  // Generate COMPLETE frame data arrays - every single byte
  const framesC = framesPacked.map((frameData, idx) => {
    if (!frameData || frameData.length === 0) {
      throw new Error(`Frame ${idx} is empty or invalid`);
    }
    
    // Convert every byte to hex - NO SHORTCUTS, NO PLACEHOLDERS
    const allHexBytes = [];
    for (let i = 0; i < frameData.length; i++) {
      allHexBytes.push('0x' + frameData[i].toString(16).toUpperCase().padStart(2, '0'));
    }
    
    // Format as lines of 16 hex values each
    const lines = [];
    for (let i = 0; i < allHexBytes.length; i += 16) {
      const lineBytes = allHexBytes.slice(i, i + 16);
      const isLastLine = i + 16 >= allHexBytes.length;
      lines.push('  ' + lineBytes.join(', ') + (isLastLine ? '' : ','));
    }
    
    return `const uint8_t PROGMEM frame_${idx}[${frameData.length}] = {\n${lines.join('\n')}\n};`;
  }).join('\n\n');

  const framesIndex = `const uint8_t* const frames[] PROGMEM = {\n  ${framesPacked.map((_, i) => `frame_${i}`).join(', ')}\n};`;
  
  console.log(`Generated complete frame data: ${framesPacked.length} frames, ${framesC.length} characters total`);
  
  // U8g2 path (monochrome, XBM bit order LSB-first)
  if (library === 'u8g2') {
    return `#include <U8g2lib.h>
#include <Wire.h>

#define SCREEN_WIDTH ${width}
#define SCREEN_HEIGHT ${height}

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

${framesC}

${framesIndex}

const int FRAME_COUNT = sizeof(frames) / sizeof(frames[0]);
const int FRAME_DELAY = ${frameDelay};

void setup() {
  Serial.begin(115200);
  u8g2.begin();
  u8g2.clearBuffer();
  u8g2.sendBuffer();
}

void loop() {
  while (true) {
    for (int frame = 0; frame < FRAME_COUNT; frame++) {
      unsigned long start = millis();
      
      u8g2.firstPage();
      do {
        u8g2.drawXBMP(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, (const uint8_t*)pgm_read_ptr(&frames[frame]));
      } while (u8g2.nextPage());
      
      while (millis() - start < FRAME_DELAY) {
      }
    }
  }
}
`;
  }

  // Adafruit GFX + SSD1331 (color) using XBitmap for monochrome frames
  if (library === 'adafruit_gfx_ssd1331') {
    return `#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1331.h>

#define SCREEN_WIDTH ${width}
#define SCREEN_HEIGHT ${height}
#define CS   10
#define DC   9
#define RST  8

Adafruit_SSD1331 display = Adafruit_SSD1331(&SPI, CS, DC, RST);

${framesC}

${framesIndex}

const int FRAME_COUNT = sizeof(frames) / sizeof(frames[0]);
const int FRAME_DELAY = ${frameDelay};

void setup() {
  Serial.begin(115200);
  display.begin();
  display.fillScreen(0x0000);
}

void loop() {
  while (true) {
    for (int frame = 0; frame < FRAME_COUNT; frame++) {
      unsigned long start = millis();
      
      display.fillScreen(0x0000);
      display.drawXBitmap(0, 0, (const uint8_t*)pgm_read_ptr(&frames[frame]), SCREEN_WIDTH, SCREEN_HEIGHT, 0xFFFF);
      
      while (millis() - start < FRAME_DELAY) {
      }
    }
  }
}
`;
  }

  // Default: Adafruit GFX + SSD1306 (monochrome) using drawXBitmap (XBM/LSB-first)
  return `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH ${width}
#define SCREEN_HEIGHT ${height}
#define OLED_RESET -1

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

${framesC}

${framesIndex}

const int FRAME_COUNT = sizeof(frames) / sizeof(frames[0]);
const int FRAME_DELAY = ${frameDelay};

void setup() {
  Serial.begin(115200);
  
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }
  
  display.clearDisplay();
  display.display();
}

void loop() {
  while (true) {
    for (int frame = 0; frame < FRAME_COUNT; frame++) {
      unsigned long start = millis();
      
      display.clearDisplay();
      display.display.drawXBitmap(0, 0, (const uint8_t*)pgm_read_ptr(&frames[frame]), SCREEN_WIDTH, SCREEN_HEIGHT, 1);
      display.display();
      
      while (millis() - start < FRAME_DELAY) {
      }
    }
  }
}
`;
}
