import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Reading parsed routes...");
  const routesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'routes_parsed.json'), 'utf8'));

  // 1. Create a default Institution
  console.log("Creating default institution...");
  const { data: instData, error: instError } = await supabase
    .from('institutions')
    .insert([
      {
        name: 'GVP College of Engineering',
        institution_code: 'GVP-2023',
        access_code: 'STUDENT123'
      }
    ])
    .select()
    .single();

  if (instError) {
    if (instError.code === '23505') {
       console.log("Institution already exists. Fetching...");
    } else {
       console.error("Error creating institution:", instError);
       return;
    }
  }

  // Fetch the institution to get the ID
  const { data: inst } = await supabase
    .from('institutions')
    .select('*')
    .eq('institution_code', 'GVP-2023')
    .single();

  if (!inst) {
      console.error("Failed to get institution.");
      return;
  }

  console.log(`Institution ID: ${inst.id}`);

  // 2. Insert Routes
  console.log(`Inserting ${routesData.length} routes...`);
  
  // Format for insert
  const routesToInsert = routesData.map(r => ({
      institution_id: inst.id,
      route_name: r.route_name,
      start_time: r.start_time,
      stops: r.stops
  }));

  const { data: insertedRoutes, error: routeError } = await supabase
    .from('routes')
    .insert(routesToInsert)
    .select();

  if (routeError) {
      console.error("Error inserting routes:", routeError);
      return;
  }

  console.log(`Successfully seeded ${insertedRoutes.length} routes for ${inst.name}.`);
  console.log(`\nDrivers can link using Institution Code: ${inst.institution_code}`);
  console.log(`Students can access live map using Access Code: ${inst.access_code}`);
}

seed();
