const DEFAULT_JWT_SECRETS = [
    'boa-admin-secret-change-in-production',
    'change-this-to-a-long-random-string'
];

const loginAttempts = new Map();

function isProduction() {
    return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

function assertProductionSecrets() {
    if (!isProduction()) {
        return;
    }

    const jwtSecret = process.env.JWT_SECRET || '';
    if (!jwtSecret || jwtSecret.length < 32 || DEFAULT_JWT_SECRETS.includes(jwtSecret)) {
        throw new Error('JWT_SECRET must be a long random string (32+ chars) in production.');
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const placeholders = ['your-service-role-key', 'paste-your', 'your-service'];
    if (!serviceKey || placeholders.some(function (text) {
        return serviceKey.includes(text);
    })) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set in production.');
    }

    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
        throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in production.');
    }
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter(options) {
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const max = options.max || 20;
    const keyPrefix = options.keyPrefix || 'rl';

    return function rateLimitMiddleware(req, res, next) {
        const key = keyPrefix + ':' + getClientIp(req);
        const now = Date.now();
        const entry = loginAttempts.get(key) || { count: 0, resetAt: now + windowMs };

        if (now > entry.resetAt) {
            entry.count = 0;
            entry.resetAt = now + windowMs;
        }

        entry.count += 1;
        loginAttempts.set(key, entry);

        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({
                success: false,
                error: 'Too many attempts. Please wait and try again.'
            });
        }

        next();
    };
}

function validateLoginInput(username, password) {
    if (typeof username !== 'string' || typeof password !== 'string') {
        return false;
    }

    if (username.length < 1 || username.length > 64) {
        return false;
    }

    if (password.length < 1 || password.length > 128) {
        return false;
    }

    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(username)) {
        return false;
    }

    return true;
}

function sendSafeError(res, status, publicMessage, internalError) {
    if (internalError) {
        console.error(internalError);
    }

    res.status(status).json({
        success: false,
        error: publicMessage,
        message: publicMessage
    });
}

function stripUserForAdmin(user) {
    return Object.assign({}, user, {
        // Never send the bcrypt hash to the browser; show admin-readable login password instead.
        password: undefined,
        username: user.username || '',
        loginPassword: user.loginPassword || '',
        hasUsername: !!user.username,
        hasPassword: !!(user.password || user.loginPassword)
    });
}

function stripAdminForResponse(admin) {
    const { getAdminForResponse } = require('../adminEnv');
    return getAdminForResponse(admin);
}

function mergeUserPasswords(incomingUsers, currentUsers) {
    return incomingUsers.map(function (incomingUser) {
        const existing = currentUsers.find(function (user) {
            return user.id === incomingUser.id;
        });

        const nextUser = Object.assign({}, incomingUser, {
            lastLoginAt: existing?.lastLoginAt ?? incomingUser.lastLoginAt ?? null,
            lastActiveAt: existing?.lastActiveAt ?? incomingUser.lastActiveAt ?? null
        });

        if (!incomingUser.password) {
            nextUser.password = existing?.password ?? incomingUser.password;
        }

        if (!incomingUser.username) {
            nextUser.username = existing?.username ?? incomingUser.username;
        }

        if (!incomingUser.loginPassword) {
            nextUser.loginPassword = existing?.loginPassword ?? incomingUser.loginPassword ?? '';
        }

        return nextUser;
    });
}

function mergeAdminPassword(incomingAdmin, currentAdmin) {
    const { isAdminEnvConfigured, getAdminUsername } = require('../adminEnv');
    if (isAdminEnvConfigured()) {
        return {
            username: getAdminUsername(),
            password: ''
        };
    }

    return {
        username: incomingAdmin?.username ?? currentAdmin.username,
        password: incomingAdmin?.password || currentAdmin.password
    };
}

const loginRateLimit = createRateLimiter({
    keyPrefix: 'login',
    windowMs: 15 * 60 * 1000,
    max: 10
});

const adminLoginRateLimit = createRateLimiter({
    keyPrefix: 'admin-login',
    windowMs: 15 * 60 * 1000,
    max: 8
});

module.exports = {
    assertProductionSecrets,
    isProduction,
    loginRateLimit,
    adminLoginRateLimit,
    validateLoginInput,
    sendSafeError,
    stripUserForAdmin,
    stripAdminForResponse,
    mergeUserPasswords,
    mergeAdminPassword
};
