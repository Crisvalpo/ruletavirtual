const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gqgmgetdypxssnfvscuj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZ21nZXRkeXB4c3NuZnZzY3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDI3MjksImV4cCI6MjA5MjQxODcyOX0.FFKWkeTo1UOaiM4W6pyZLjj3uWYdIeLUJFo5SgzLUZg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTickets() {
  console.log("Consultando la tabla game_packages...");
  const { data, error } = await supabase
    .from('game_packages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error al consultar game_packages:", error);
  } else {
    console.log("Últimos 10 tickets en game_packages:");
    console.log(JSON.stringify(data, null, 2));
  }
}

checkTickets();
