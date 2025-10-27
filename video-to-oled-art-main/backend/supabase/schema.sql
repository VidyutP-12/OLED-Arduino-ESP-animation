-- Video to OLED Backend Database Schema
-- This schema creates all necessary tables for the video processing backend

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_tier AS ENUM ('free', 'premium', 'pro');
CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE display_size AS ENUM ('128x64', '96x64', '128x32', '64x48', 'custom');
CREATE TYPE orientation AS ENUM ('horizontal', 'vertical');
CREATE TYPE arduino_library AS ENUM ('adafruit_gfx_ssd1306', 'adafruit_gfx_ssd1331', 'u8g2');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    tier user_tier DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_uploads INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_processing_time INTEGER DEFAULT 0, -- in seconds
    storage_used BIGINT DEFAULT 0, -- in bytes
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true
);

-- Video uploads table
CREATE TABLE public.video_uploads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    original_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    duration DECIMAL(10,3), -- in seconds
    width INTEGER,
    height INTEGER,
    fps DECIMAL(5,2),
    upload_path TEXT NOT NULL,
    status processing_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    metadata JSONB DEFAULT '{}'
);

-- Processing configurations table
CREATE TABLE public.processing_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT,
    display_size display_size NOT NULL,
    orientation orientation NOT NULL,
    library arduino_library NOT NULL,
    target_fps INTEGER DEFAULT 15,
    max_frames INTEGER DEFAULT 20,
    threshold INTEGER DEFAULT 128,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processed videos table
CREATE TABLE public.processed_videos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    upload_id UUID REFERENCES public.video_uploads(id) ON DELETE CASCADE NOT NULL,
    config_id UUID REFERENCES public.processing_configs(id) ON DELETE SET NULL,
    display_size display_size NOT NULL,
    orientation orientation NOT NULL,
    library arduino_library NOT NULL,
    target_fps INTEGER NOT NULL,
    actual_fps DECIMAL(5,2) NOT NULL,
    frame_count INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    duration DECIMAL(10,3) NOT NULL,
    arduino_code TEXT NOT NULL,
    code_size BIGINT NOT NULL,
    processing_time INTEGER NOT NULL, -- in milliseconds
    status processing_status DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    metadata JSONB DEFAULT '{}'
);

-- Frame data table (for storing individual frame data)
CREATE TABLE public.frame_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    processed_video_id UUID REFERENCES public.processed_videos(id) ON DELETE CASCADE NOT NULL,
    frame_index INTEGER NOT NULL,
    frame_data BYTEA NOT NULL, -- packed frame data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(processed_video_id, frame_index)
);

-- Usage analytics table
CREATE TABLE public.usage_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL, -- 'upload', 'process', 'download', 'view'
    resource_type TEXT, -- 'video', 'code', 'config'
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions table
CREATE TABLE public.user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API rate limits table
CREATE TABLE public.rate_limits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, endpoint, window_start)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_tier ON public.users(tier);
CREATE INDEX idx_users_last_active ON public.users(last_active);

CREATE INDEX idx_video_uploads_user_id ON public.video_uploads(user_id);
CREATE INDEX idx_video_uploads_status ON public.video_uploads(status);
CREATE INDEX idx_video_uploads_created_at ON public.video_uploads(created_at);
CREATE INDEX idx_video_uploads_expires_at ON public.video_uploads(expires_at);

CREATE INDEX idx_processing_configs_user_id ON public.processing_configs(user_id);
CREATE INDEX idx_processing_configs_is_default ON public.processing_configs(is_default);

CREATE INDEX idx_processed_videos_user_id ON public.processed_videos(user_id);
CREATE INDEX idx_processed_videos_upload_id ON public.processed_videos(upload_id);
CREATE INDEX idx_processed_videos_status ON public.processed_videos(status);
CREATE INDEX idx_processed_videos_created_at ON public.processed_videos(created_at);
CREATE INDEX idx_processed_videos_expires_at ON public.processed_videos(expires_at);

CREATE INDEX idx_frame_data_processed_video_id ON public.frame_data(processed_video_id);
CREATE INDEX idx_frame_data_frame_index ON public.frame_data(frame_index);

CREATE INDEX idx_usage_analytics_user_id ON public.usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_action ON public.usage_analytics(action);
CREATE INDEX idx_usage_analytics_created_at ON public.usage_analytics(created_at);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

CREATE INDEX idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint);
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits(window_start);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_video_uploads_updated_at BEFORE UPDATE ON public.video_uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processing_configs_updated_at BEFORE UPDATE ON public.processing_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processed_videos_updated_at BEFORE UPDATE ON public.processed_videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frame_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Video uploads policies
CREATE POLICY "Users can view own uploads" ON public.video_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own uploads" ON public.video_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own uploads" ON public.video_uploads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own uploads" ON public.video_uploads FOR DELETE USING (auth.uid() = user_id);

-- Processing configs policies
CREATE POLICY "Users can view own configs" ON public.processing_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own configs" ON public.processing_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own configs" ON public.processing_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own configs" ON public.processing_configs FOR DELETE USING (auth.uid() = user_id);

-- Processed videos policies
CREATE POLICY "Users can view own processed videos" ON public.processed_videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own processed videos" ON public.processed_videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own processed videos" ON public.processed_videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own processed videos" ON public.processed_videos FOR DELETE USING (auth.uid() = user_id);

-- Frame data policies
CREATE POLICY "Users can view own frame data" ON public.frame_data FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.processed_videos 
        WHERE id = processed_video_id AND user_id = auth.uid()
    )
);
CREATE POLICY "Users can insert own frame data" ON public.frame_data FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.processed_videos 
        WHERE id = processed_video_id AND user_id = auth.uid()
    )
);
CREATE POLICY "Users can update own frame data" ON public.frame_data FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.processed_videos 
        WHERE id = processed_video_id AND user_id = auth.uid()
    )
);
CREATE POLICY "Users can delete own frame data" ON public.frame_data FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.processed_videos 
        WHERE id = processed_video_id AND user_id = auth.uid()
    )
);

-- Usage analytics policies
CREATE POLICY "Users can view own analytics" ON public.usage_analytics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analytics" ON public.usage_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User sessions policies
CREATE POLICY "Users can view own sessions" ON public.user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.user_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.user_sessions FOR DELETE USING (auth.uid() = user_id);

-- Rate limits policies
CREATE POLICY "Users can view own rate limits" ON public.rate_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rate limits" ON public.rate_limits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rate limits" ON public.rate_limits FOR UPDATE USING (auth.uid() = user_id);

-- Create functions for common operations

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'display_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to clean up expired data
CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Delete expired video uploads
    DELETE FROM public.video_uploads WHERE expires_at < NOW();
    
    -- Delete expired processed videos
    DELETE FROM public.processed_videos WHERE expires_at < NOW();
    
    -- Delete expired sessions
    DELETE FROM public.user_sessions WHERE expires_at < NOW();
    
    -- Delete old rate limit records (older than 1 hour)
    DELETE FROM public.rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
    
    -- Delete old analytics (older than 1 year)
    DELETE FROM public.usage_analytics WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user statistics
CREATE OR REPLACE FUNCTION public.get_user_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_uploads', COALESCE(u.total_uploads, 0),
        'total_conversions', COALESCE(u.total_conversions, 0),
        'total_processing_time', COALESCE(u.total_processing_time, 0),
        'storage_used', COALESCE(u.storage_used, 0),
        'tier', u.tier,
        'created_at', u.created_at,
        'last_active', u.last_active,
        'recent_uploads', (
            SELECT COUNT(*) 
            FROM public.video_uploads 
            WHERE user_id = user_uuid 
            AND created_at > NOW() - INTERVAL '7 days'
        ),
        'recent_conversions', (
            SELECT COUNT(*) 
            FROM public.processed_videos 
            WHERE user_id = user_uuid 
            AND created_at > NOW() - INTERVAL '7 days'
        )
    ) INTO result
    FROM public.users u
    WHERE u.id = user_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    user_uuid UUID,
    endpoint_name TEXT,
    max_requests INTEGER DEFAULT 100,
    window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    window_start TIMESTAMP WITH TIME ZONE;
BEGIN
    window_start := date_trunc('hour', NOW()) + 
                   (EXTRACT(minute FROM NOW())::INTEGER / window_minutes) * 
                   INTERVAL '1 minute' * window_minutes;
    
    SELECT COALESCE(request_count, 0) INTO current_count
    FROM public.rate_limits
    WHERE user_id = user_uuid 
    AND endpoint = endpoint_name 
    AND window_start = window_start;
    
    IF current_count >= max_requests THEN
        RETURN FALSE;
    END IF;
    
    -- Increment or insert rate limit record
    INSERT INTO public.rate_limits (user_id, endpoint, request_count, window_start)
    VALUES (user_uuid, endpoint_name, 1, window_start)
    ON CONFLICT (user_id, endpoint, window_start)
    DO UPDATE SET request_count = rate_limits.request_count + 1;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default processing configurations
INSERT INTO public.processing_configs (user_id, name, display_size, orientation, library, target_fps, max_frames, threshold, is_default)
VALUES 
    (NULL, 'Default 128x64 Horizontal', '128x64', 'horizontal', 'adafruit_gfx_ssd1306', 15, 20, 128, true),
    (NULL, 'Default 128x64 Vertical', '128x64', 'vertical', 'adafruit_gfx_ssd1306', 15, 20, 128, true),
    (NULL, 'Default 96x64 Horizontal', '96x64', 'horizontal', 'adafruit_gfx_ssd1306', 15, 20, 128, true),
    (NULL, 'Default 128x32 Horizontal', '128x32', 'horizontal', 'adafruit_gfx_ssd1306', 15, 20, 128, true),
    (NULL, 'Default 64x48 Horizontal', '64x48', 'horizontal', 'adafruit_gfx_ssd1306', 15, 20, 128, true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

