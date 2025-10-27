const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

async function setupSupabase() {
  console.log('🚀 Setting up Supabase database...');

  // Check for required environment variables
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.log('Please set these variables in your .env file');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');

    console.log('📄 Executing database schema...');

    // Execute the schema
    const { data, error } = await supabase.rpc('exec_sql', { sql: schema });

    if (error) {
      console.error('❌ Error executing schema:', error);
      process.exit(1);
    }

    console.log('✅ Database schema executed successfully');

    // Test the connection
    console.log('🔍 Testing database connection...');
    
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Database connection test failed:', testError);
      process.exit(1);
    }

    console.log('✅ Database connection successful');

    // Create default processing configurations
    console.log('⚙️ Creating default processing configurations...');
    
    const defaultConfigs = [
      {
        name: 'Default 128x64 Horizontal',
        display_size: '128x64',
        orientation: 'horizontal',
        library: 'adafruit_gfx_ssd1306',
        target_fps: 15,
        max_frames: 20,
        threshold: 128,
        is_default: true
      },
      {
        name: 'Default 128x64 Vertical',
        display_size: '128x64',
        orientation: 'vertical',
        library: 'adafruit_gfx_ssd1306',
        target_fps: 15,
        max_frames: 20,
        threshold: 128,
        is_default: true
      },
      {
        name: 'Default 96x64 Horizontal',
        display_size: '96x64',
        orientation: 'horizontal',
        library: 'adafruit_gfx_ssd1306',
        target_fps: 15,
        max_frames: 20,
        threshold: 128,
        is_default: true
      },
      {
        name: 'Default 128x32 Horizontal',
        display_size: '128x32',
        orientation: 'horizontal',
        library: 'adafruit_gfx_ssd1306',
        target_fps: 15,
        max_frames: 20,
        threshold: 128,
        is_default: true
      },
      {
        name: 'Default 64x48 Horizontal',
        display_size: '64x48',
        orientation: 'horizontal',
        library: 'adafruit_gfx_ssd1306',
        target_fps: 15,
        max_frames: 20,
        threshold: 128,
        is_default: true
      }
    ];

    for (const config of defaultConfigs) {
      const { error: configError } = await supabase
        .from('processing_configs')
        .upsert(config, { onConflict: 'name' });

      if (configError) {
        console.warn('⚠️ Warning: Could not create config:', config.name, configError.message);
      } else {
        console.log('✅ Created config:', config.name);
      }
    }

    console.log('🎉 Supabase setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Test the API endpoints');
    console.log('3. Configure your frontend to use the backend API');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupSupabase();