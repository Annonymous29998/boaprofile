const { createClient } = require('@supabase/supabase-js');

let client = null;

function isSupabaseConfigured() {
    const url = (process.env.SUPABASE_URL || '').trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    return !!(url && serviceKey && url.indexOf('supabase.co') !== -1);
}

function getSupabase() {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    if (!client) {
        client = createClient(
            process.env.SUPABASE_URL.trim(),
            process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
    }

    return client;
}

module.exports = {
    getSupabase,
    isSupabaseConfigured
};
