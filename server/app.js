const preexistingPort = process.env.PORT;
require('dotenv').config({ override: true });
if (preexistingPort) {
    process.env.PORT = preexistingPort;
}

const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');
const { assertProductionSecrets } = require('./middleware/security');

const rootDir = path.join(__dirname, '..');
const app = express();
let productionSecretsChecked = false;

app.disable('x-powered-by');

app.use(function (req, res, next) {
    if (!productionSecretsChecked) {
        try {
            assertProductionSecrets();
            productionSecretsChecked = true;
        } catch (error) {
            console.error(error);
            return res.status(503).json({
                success: false,
                error: 'Service configuration is incomplete. Check server environment variables.'
            });
        }
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com data:; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    next();
});

app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRoutes);
app.use(express.static(rootDir, {
    etag: true,
    lastModified: true,
    maxAge: process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' ? '1h' : 0,
    setHeaders: function (res, filePath) {
        if (/\.(?:css|js|svg|woff2?|png|jpg|jpeg|gif|ico)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        } else if (/\.html?$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

app.get('/admin', function (req, res) {
    res.sendFile(path.join(rootDir, 'admin', 'index.html'));
});

app.get('/admin/', function (req, res) {
    res.sendFile(path.join(rootDir, 'admin', 'index.html'));
});

module.exports = app;
