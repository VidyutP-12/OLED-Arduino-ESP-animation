# Video to OLED Backend Setup Guide

This guide will help you set up the complete backend infrastructure for the Video to OLED converter using Supabase.

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- FFmpeg installed on your system
- A Supabase account and project

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [FFmpeg official website](https://ffmpeg.org/download.html)

### 4. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to your project dashboard
3. Navigate to Settings > API
4. Copy your project URL and API keys

### 5. Configure Environment

```bash
cp env.example .env
```

Edit `.env` with your Supabase credentials:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 6. Set up Database Schema

```bash
npm run db:migrate
```

Or manually run the SQL schema in your Supabase SQL editor:
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/schema.sql`
4. Click "Run"

### 7. Start the Backend

```bash
npm run dev
```

The backend will be available at `http://localhost:3001`

## 📊 Database Schema

The backend uses the following main tables:

- **users**: User profiles and statistics
- **video_uploads**: Video file metadata
- **processing_configs**: Processing configuration settings
- **processed_videos**: Generated Arduino code and metadata
- **frame_data**: Individual frame data storage
- **usage_analytics**: User activity tracking
- **user_sessions**: Session management
- **rate_limits**: API rate limiting

## 🔧 API Endpoints

### Authentication
All endpoints require authentication via Supabase JWT tokens in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Video Processing

#### Upload Video
```http
POST /api/videos/upload
Content-Type: multipart/form-data

video: <file>
```

#### Process Video
```http
POST /api/videos/:uploadId/process
Content-Type: application/json

{
  "displaySize": "128x64",
  "orientation": "horizontal",
  "library": "adafruit_gfx_ssd1306",
  "targetFps": 15,
  "threshold": 128,
  "maxFrames": 20
}
```

#### Get Processing Status
```http
GET /api/videos/:uploadId/status
```

#### Download Arduino Code
```http
GET /api/videos/processed/:processedId/download
```

### User Management

#### Get Profile
```http
GET /api/user/profile
```

#### Update Profile
```http
PUT /api/user/profile
Content-Type: application/json

{
  "displayName": "New Name",
  "preferences": {}
}
```

#### Get Statistics
```http
GET /api/user/stats
```

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Set up environment variables
cp env.example .env
# Edit .env with your Supabase credentials

# Start the backend
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the backend
docker-compose down
```

### Using Docker

```bash
# Build the image
docker build -t video-to-oled-backend .

# Run the container
docker run -p 3001:3001 --env-file .env video-to-oled-backend
```

## 🔒 Security Features

- **Row Level Security (RLS)**: Database-level security policies
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents abuse and DDoS attacks
- **Input Validation**: File type and size validation
- **CORS Protection**: Cross-origin request protection
- **Helmet**: Security headers
- **File Upload Limits**: Size and type restrictions

## 📈 Monitoring and Analytics

The backend tracks:
- User uploads and conversions
- Processing times and success rates
- API usage patterns
- Error rates and types

## 🛠️ Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Cleanup
```bash
npm run cleanup
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Required |
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `MAX_FILE_SIZE` | Maximum file upload size | 100MB |
| `MAX_VIDEO_DURATION` | Maximum video duration (seconds) | 30 |
| `TARGET_FPS` | Target frame rate | 15 |
| `MAX_FRAMES` | Maximum frames to extract | 20 |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:5173 |

### Supported Video Formats

- MP4
- AVI
- MOV
- MKV
- WebM

### Display Sizes

- 128x64 (Most Common)
- 96x64
- 128x32
- 64x48
- Custom (128x128)

### Arduino Libraries

- Adafruit GFX + SSD1306
- Adafruit GFX + SSD1331
- U8g2

## 🚨 Troubleshooting

### Common Issues

1. **FFmpeg not found**
   - Ensure FFmpeg is installed and in your PATH
   - Set the FFmpeg path in the VideoProcessor constructor

2. **Supabase connection errors**
   - Verify your environment variables
   - Check your Supabase project status
   - Ensure RLS policies are correctly configured

3. **File upload failures**
   - Check file size limits
   - Verify supported file types
   - Ensure upload directory permissions

4. **Memory issues**
   - Reduce MAX_FRAMES for large videos
   - Implement streaming for large files
   - Monitor server memory usage

## 📚 API Documentation

For detailed API documentation, visit:
- Health check: `http://localhost:3001/health`
- API root: `http://localhost:3001/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

