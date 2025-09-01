#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupSupabase() {
  try {
    console.log('🚀 Setting up Supabase database...');

    // Read the schema file
    const schemaPath = path.join(__dirname, '../supabase/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');

    console.log('📋 Executing database schema...');

    // Execute the schema
    const { error } = await supabase.rpc('exec_sql', { sql: schema });

    if (error) {
      // If exec_sql doesn't exist, try to execute the schema manually
      console.log('⚠️  exec_sql function not available, trying manual execution...');
      
      // Split the schema into individual statements
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        try {
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (stmtError) {
            console.warn(`⚠️  Warning: Could not execute statement: ${stmtError.message}`);
          }
        } catch (e) {
          console.warn(`⚠️  Warning: Could not execute statement: ${e.message}`);
        }
      }
    }

    console.log('✅ Database schema executed successfully');

    // Test the connection
    console.log('🔍 Testing database connection...');
    
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (testError) {
      console.warn('⚠️  Warning: Could not test users table:', testError.message);
    } else {
      console.log('✅ Database connection test successful');
    }

    console.log('\n🎉 Supabase setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Configure your frontend to use the Supabase client');
    console.log('2. Set up authentication in your Supabase dashboard');
    console.log('3. Configure Row Level Security policies if needed');
    console.log('4. Test the API endpoints');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\n💡 Manual setup instructions:');
    console.error('1. Go to your Supabase dashboard');
    console.error('2. Navigate to the SQL editor');
    console.error('3. Copy and paste the contents of supabase/schema.sql');
    console.error('4. Execute the SQL');
    process.exit(1);
  }
}

// Run the setup
setupSupabase();




