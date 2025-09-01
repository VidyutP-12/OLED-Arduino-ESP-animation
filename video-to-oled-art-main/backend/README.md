# Video to OLED Backend

A complete backend solution for converting videos to Arduino OLED code using Supabase as the database and FFmpeg for video processing.

## Features

- **Video Processing**: FFmpeg-based video frame extraction and monochrome conversion
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth with JWT tokens
- **File Upload**: Multer-based file handling with validation
- **Arduino Code Generation**: Support for multiple libraries (Adafruit GFX, U8g2)
- **Rate Limiting**: Built-in rate limiting and security measures
- **Analytics**: Usage tracking and user statistics
- **Premium Features**: Support for premium user tiers

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Video Processing**: FFmpeg
- **File Upload**: Multer
- **Security**: Helmet, CORS, Rate Limiting

## Prerequisites

- Node.js 18 or higher
- FFmpeg installed on your system
- Supabase account and project

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install FFmpeg**
   
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

4. **Set up Supabase**
   
   - Create a new Supabase project
   - Run the SQL schema from `supabase/schema.sql` in your Supabase SQL editor
   - Get your project URL and API keys

5. **Configure environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your Supabase credentials:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

## Database Schema

The backend uses the following main tables:

- **users**: User profiles and statistics
- **video_uploads**: Video file metadata
- **processing_configs**: Processing configuration settings
- **processed_videos**: Generated Arduino code and metadata
- **frame_data**: Individual frame data storage
- **usage_analytics**: User activity tracking
- **user_sessions**: Session management

## API Endpoints

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
  "maxFrames": 300
}
```

#### Get Processing Status
```http
GET /api/videos/:uploadId/status
```

#### Get Processed Video
```http
GET /api/videos/processed/:processedId
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
  "email": "newemail@example.com"
}
```

#### Get Statistics
```http
GET /api/user/stats
```

#### Get Analytics
```http
GET /api/user/analytics?limit=50&offset=0
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Required |
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `MAX_FILE_SIZE` | Maximum file upload size | 50MB |
| `MAX_VIDEO_DURATION` | Maximum video duration (seconds) | 30 |
| `TARGET_FPS` | Target frame rate | 15 |
| `MAX_FRAMES` | Maximum frames to extract | 300 |
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

## Development

### Start Development Server
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Build for Production
```bash
npm run build
```

## Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment

1. **Set environment variables**
   ```bash
   export NODE_ENV=production
   export SUPABASE_URL=your_production_supabase_url
   export SUPABASE_ANON_KEY=your_production_anon_key
   export SUPABASE_SERVICE_ROLE_KEY=your_production_service_key
   ```

2. **Start the server**
   ```bash
   npm start
   ```

### Docker Deployment

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t video-to-oled-backend .
docker run -p 3001:3001 --env-file .env video-to-oled-backend
```

## Security Features

- **Row Level Security (RLS)**: Database-level security policies
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents abuse and DDoS attacks
- **Input Validation**: File type and size validation
- **CORS Protection**: Cross-origin request protection
- **Helmet**: Security headers
- **File Upload Limits**: Size and type restrictions

## Monitoring and Analytics

The backend tracks:
- User uploads and conversions
- Processing times and success rates
- API usage patterns
- Error rates and types

## Error Handling

The backend includes comprehensive error handling for:
- File upload errors
- Video processing failures
- Database connection issues
- Authentication errors
- Rate limiting violations

## Performance Considerations

- **Async Processing**: Video processing runs asynchronously
- **File Cleanup**: Temporary files are automatically cleaned up
- **Database Indexing**: Optimized queries with proper indexes
- **Compression**: Response compression for large files
- **Caching**: Consider implementing Redis for caching

## Troubleshooting

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.




