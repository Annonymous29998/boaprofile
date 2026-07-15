const path = require('path');
const preexistingPort = process.env.PORT;
require('dotenv').config({
    path: path.join(__dirname, '..', '.env'),
    override: true
});
// Keep PORT from the process (e.g. Playwright webServer) if it was already set
if (preexistingPort) {
    process.env.PORT = preexistingPort;
}

const app = require('./app');
const { seedDatabase, useSupabase } = require('./database');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await seedDatabase();
        app.listen(PORT, function () {
            console.log('Server running at http://localhost:' + PORT);
            console.log('Admin dashboard: http://localhost:' + PORT + '/admin');
            console.log('Storage: ' + (useSupabase() ? 'Supabase configured' : 'local JSON file'));
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();
