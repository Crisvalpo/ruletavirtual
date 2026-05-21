const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

async function getSpec() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/';
    const response = await fetch(url, {
        headers: {
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY
        }
    });
    const data = await response.json();
    console.log("Functions:");
    if (data.paths) {
        Object.keys(data.paths).forEach(p => {
            if (p.startsWith('/rpc/')) {
                console.log(p);
            }
        });
    }
}

getSpec();
