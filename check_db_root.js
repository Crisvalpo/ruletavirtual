
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- Checking screen_state ---');
    const { data: screens, error: screenErr } = await supabase.from('screen_state').select('*');
    if (screenErr) console.error('Screen Error:', screenErr);
    else console.log('Screens found:', screens.length, screens.map(s => s.screen_number));

    console.log('--- Testing single fetch for screen 1 ---');
    const { data: s1, error: s1Err } = await supabase.from('screen_state').select('*').eq('screen_number', 1).single();
    if (s1Err) console.error('Screen 1 Error:', JSON.stringify(s1Err, null, 2));
    else console.log('Screen 1 found:', s1.screen_number);
}

check();
