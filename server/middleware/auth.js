const jwt = require('jsonwebtoken');

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not set.');
    }
    return secret;
}

function signAdminToken(username) {
    return jwt.sign({ role: 'admin', username }, getJwtSecret(), { expiresIn: '12h' });
}

function signUserToken(userId) {
    return jwt.sign({ role: 'user', userId }, getJwtSecret(), { expiresIn: '1h' });
}

function requireAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Admin authentication required.' });
    }

    try {
        const payload = jwt.verify(token, getJwtSecret());
        if (payload.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        req.admin = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired admin session.' });
    }
}

function requireUser(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'User session is required.' });
    }

    try {
        const payload = jwt.verify(token, getJwtSecret());
        if (payload.role !== 'user' || !payload.userId) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired user session.' });
    }
}

module.exports = {
    getJwtSecret,
    signAdminToken,
    signUserToken,
    requireAdmin,
    requireUser
};
