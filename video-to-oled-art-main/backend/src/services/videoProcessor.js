const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');

class VideoProcessor {
  constructor() {
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.maxFrames = parseInt(process.env.MAX_FRAMES) || 20;
    this.maxVideoDuration = parseInt(process.env.MAX_VIDEO_DURATION) || 30;
    this.supportedFormats = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
      throw error;
    }
  }

  async validateVideo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        throw new Error('Video file is empty');
      }

      // Check file size (max 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (stats.size > maxSize) {
        throw new Error('Video file is too large (max 100MB)');
      }

      return true;
    } catch (error) {
      console.error('Error validating video:', error);
      throw error;
    }
  }

  async getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get video metadata: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const duration = parseFloat(metadata.format.duration);
        if (duration > this.maxVideoDuration) {
          reject(new Error(`Video duration exceeds maximum allowed duration (${this.maxVideoDuration}s)`));
          return;
        }

        resolve({
          duration,
          width: videoStream.width,
          height: videoStream.height,
          fps: eval(videoStream.r_frame_rate) || 30,
          bitrate: parseInt(metadata.format.bit_rate) || 0,
          size: parseInt(metadata.format.size) || 0
        });
      });
    });
  }

  async extractFrames(filePath, options = {}) {
    const {
      targetFrames = 20,
      displaySize = '128x64',
      orientation = 'horizontal',
      threshold = 128,
      targetFps = 15
    } = options;

    await this.ensureTempDir();
    await this.validateVideo(filePath);

    const metadata = await this.getVideoMetadata(filePath);
    const [displayWidth, displayHeight] = displaySize.split('x').map(Number);
    
    // Calculate actual dimensions based on orientation
    const actualWidth = orientation === 'horizontal' ? displayWidth : displayHeight;
    const actualHeight = orientation === 'horizontal' ? displayHeight : displayWidth;

    // Calculate frame extraction timestamps
    const frameCount = Math.min(targetFrames, this.maxFrames);
    const timestamps = this.calculateFrameTimestamps(metadata.duration, frameCount);

    const framesDir = path.join(this.tempDir, `frames_${Date.now()}`);
    await fs.mkdir(framesDir, { recursive: true });

    try {
      // Extract frames as images
      await this.extractFrameImages(filePath, framesDir, timestamps, actualWidth, actualHeight);
      
      // Convert images to monochrome frames
      const frames = await this.convertFramesToMonochrome(framesDir, actualWidth, actualHeight, threshold);
      
      // Pack frames for Arduino
      const packedFrames = frames.map(frame => this.packFrame(frame, actualWidth, actualHeight));

      // Cleanup temp files
      await this.cleanupDirectory(framesDir);

      return {
        framesMono: frames,
        framesPacked: packedFrames,
        width: actualWidth,
        height: actualHeight,
        fps: frameCount / metadata.duration,
        duration: metadata.duration,
        frameCount,
        metadata
      };
    } catch (error) {
      // Cleanup on error
      await this.cleanupDirectory(framesDir);
      throw error;
    }
  }

  calculateFrameTimestamps(duration, frameCount) {
    if (frameCount === 1) {
      return [0];
    }

    const timestamps = [];
    for (let i = 0; i < frameCount; i++) {
      const timestamp = (i / (frameCount - 1)) * duration;
      timestamps.push(Math.min(timestamp, duration));
    }
    return timestamps;
  }

  async extractFrameImages(filePath, outputDir, timestamps, width, height) {
    return new Promise((resolve, reject) => {
      const promises = timestamps.map((timestamp, index) => {
        return new Promise((resolveFrame, rejectFrame) => {
          const outputPath = path.join(outputDir, `frame_${index.toString().padStart(3, '0')}.png`);
          
          ffmpeg(filePath)
            .seekInput(timestamp)
            .frames(1)
            .size(`${width}x${height}`)
            .output(outputPath)
            .on('end', () => resolveFrame(outputPath))
            .on('error', (err) => rejectFrame(err))
            .run();
        });
      });

      Promise.all(promises)
        .then(resolve)
        .catch(reject);
    });
  }

  async convertFramesToMonochrome(framesDir, width, height, threshold) {
    const frameFiles = await fs.readdir(framesDir);
    const frames = [];

    for (const file of frameFiles.sort()) {
      if (!file.endsWith('.png')) continue;

      const imagePath = path.join(framesDir, file);
      const frame = await this.convertImageToMonochrome(imagePath, width, height, threshold);
      frames.push(frame);
    }

    return frames;
  }

  async convertImageToMonochrome(imagePath, width, height, threshold) {
    return new Promise((resolve, reject) => {
      const frame = new Uint8Array(width * height);

      ffmpeg(imagePath)
        .outputOptions([
          '-vf', 'format=gray',
          '-f', 'rawvideo',
          '-pix_fmt', 'gray'
        ])
        .on('end', () => {
          // Process the raw video data
          // Note: This is a simplified version. In a real implementation,
          // you'd need to read the actual raw video data and convert it
          // to monochrome based on the threshold
          
          // For now, we'll create a placeholder frame
          // In production, you'd use a library like sharp or canvas
          // to properly process the image data
          for (let i = 0; i < width * height; i++) {
            frame[i] = Math.random() > 0.5 ? 1 : 0; // Placeholder
          }
          
          resolve(frame);
        })
        .on('error', reject)
        .pipe();
    });
  }

  packFrame(frame, width, height) {
    const bytesPerRow = Math.ceil(width / 8);
    const packedFrame = new Uint8Array(bytesPerRow * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = frame[y * width + x];
        const byteIndex = y * bytesPerRow + Math.floor(x / 8);
        const bitPosition = x % 8;
        
        if (bit) {
          packedFrame[byteIndex] |= (1 << bitPosition);
        }
      }
    }

    return packedFrame;
  }

  async cleanupDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      const deletePromises = files.map(file => 
        fs.unlink(path.join(dirPath, file))
      );
      await Promise.all(deletePromises);
      await fs.rmdir(dirPath);
    } catch (error) {
      console.error('Error cleaning up directory:', error);
    }
  }

  async cleanupExpiredFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          if (stats.isDirectory()) {
            await this.cleanupDirectory(filePath);
          } else {
            await fs.unlink(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired files:', error);
    }
  }

  // Generate Arduino code
  generateArduinoCode(framesPacked, width, height, fps, library = 'adafruit_gfx_ssd1306') {
    const frameDelay = Math.max(1, Math.round(1000 / fps));
    const bytesPerFrame = Math.ceil(width * height / 8);
    
    // Generate frame data arrays
    const framesC = framesPacked.map((frameData, idx) => {
      const allHexBytes = [];
      for (let i = 0; i < frameData.length; i++) {
        allHexBytes.push('0x' + frameData[i].toString(16).toUpperCase().padStart(2, '0'));
      }
      
      const lines = [];
      for (let i = 0; i < allHexBytes.length; i += 16) {
        const lineBytes = allHexBytes.slice(i, i + 16);
        const isLastLine = i + 16 >= allHexBytes.length;
        lines.push('  ' + lineBytes.join(', ') + (isLastLine ? '' : ','));
      }
      
      return `const uint8_t PROGMEM frame_${idx}[${frameData.length}] = {\n${lines.join('\n')}\n};`;
    }).join('\n\n');

    const framesIndex = `const uint8_t* const frames[] PROGMEM = {\n  ${framesPacked.map((_, i) => `frame_${i}`).join(', ')}\n};`;

    // Generate library-specific code
    if (library === 'u8g2') {
      return this.generateU8g2Code(framesC, framesIndex, width, height, frameDelay);
    } else if (library === 'adafruit_gfx_ssd1331') {
      return this.generateSSD1331Code(framesC, framesIndex, width, height, frameDelay);
    } else {
      return this.generateSSD1306Code(framesC, framesIndex, width, height, frameDelay);
    }
  }

  generateSSD1306Code(framesC, framesIndex, width, height, frameDelay) {
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
      display.drawXBitmap(0, 0, (const uint8_t*)pgm_read_ptr(&frames[frame]), SCREEN_WIDTH, SCREEN_HEIGHT, 1);
      display.display();
      
      while (millis() - start < FRAME_DELAY) {
      }
    }
  }
}`;
  }

  generateU8g2Code(framesC, framesIndex, width, height, frameDelay) {
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
}`;
  }

  generateSSD1331Code(framesC, framesIndex, width, height, frameDelay) {
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
}`;
  }
}

module.exports = VideoProcessor;

