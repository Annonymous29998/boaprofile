const express = require('express');
const {
    getPublicConfig,
    getData,
    saveData,
    getAdminUsers,
    validateUserLogin,
    validateAdminLogin,
    recordUserLogin,
    enrichUserSession
} = require('../database');
const { getMaxUsers, USER_LIMIT_MESSAGE } = require('../constants');
const { signAdminToken, signUserToken, requireAdmin, requireUser, getJwtSecret } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { addSseClient, removeSseClient } = require('../realtime');
const {
    loginRateLimit,
    adminLoginRateLimit,
    validateLoginInput,
    sendSafeError,
    stripUserForAdmin,
    stripAdminForResponse,
    mergeUserPasswords,
    mergeAdminPassword
} = require('../middleware/security');

const router = express.Router();

router.post('/login', loginRateLimit, async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!validateLoginInput(username, password)) {
            return res.status(400).json({ success: false, message: 'Invalid login request.' });
        }

        const user = await validateUserLogin(username, password);
        if (user) {
            await recordUserLogin(user.id);
            const token = signUserToken(user.id);
            return res.json({ success: true, userId: user.id, token: token });
        }

        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    } catch (error) {
        return sendSafeError(res, 500, 'Unable to sign in right now.', error);
    }
});

router.get('/public/realtime-config', async (req, res) => {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const placeholders = ['your-anon-key', 'paste-your'];

    if (!url || !anonKey || placeholders.some(function (text) {
        return anonKey.includes(text);
    })) {
        return res.json({ enabled: false });
    }

    res.json({
        enabled: true,
        url: url,
        anonKey: anonKey
    });
});

router.get('/updates', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) {
            return res.status(401).end();
        }

        const payload = jwt.verify(token, getJwtSecret());
        if (payload.role !== 'user' || !payload.userId) {
            return res.status(403).end();
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
        }
        res.write('data: {"event":"connected"}\n\n');
        addSseClient(res);

        req.on('close', function () {
            removeSseClient(res);
        });
    } catch (error) {
        res.status(401).end();
    }
});

router.get('/config', requireUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const config = await getPublicConfig(userId);
        res.json(config);
    } catch (error) {
        if (error.message === 'User not found.') {
            return res.status(404).json({ error: 'Account not found.' });
        }
        return sendSafeError(res, 500, 'Unable to load account settings.', error);
    }
});

router.get('/transactions', requireUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const config = await getPublicConfig(userId);
        res.json(config.transactions || []);
    } catch (error) {
        return sendSafeError(res, 500, 'Unable to load transactions.', error);
    }
});

router.post('/admin/login', adminLoginRateLimit, async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!validateLoginInput(username, password)) {
            return res.status(400).json({ success: false, message: 'Invalid login request.' });
        }

        const isValid = await validateAdminLogin(username, password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
        }

        const token = signAdminToken(username);
        res.json({ success: true, token });
    } catch (error) {
        return sendSafeError(res, 500, 'Unable to sign in right now.', error);
    }
});

router.get('/admin/data', requireAdmin, async (req, res) => {
    try {
        const data = await getData();
        const users = await getAdminUsers();
        const onlineCount = users.filter(function (user) {
            return user.isOnline;
        }).length;

        res.json({
            admin: stripAdminForResponse(data.admin),
            users: users.map(stripUserForAdmin),
            limits: {
                maxUsers: getMaxUsers(),
                userCount: users.length,
                onlineCount: onlineCount
            }
        });
    } catch (error) {
        return sendSafeError(res, 500, 'Unable to load admin data.', error);
    }
});

router.put('/admin/data', requireAdmin, async (req, res) => {
    try {
        const incoming = req.body || {};
        const current = await getData();
        const maxUsers = getMaxUsers();

        const nextUsers = mergeUserPasswords(
            Array.isArray(incoming.users) && incoming.users.length > 0 ? incoming.users : current.users,
            current.users
        );

        if (maxUsers !== null && nextUsers.length > maxUsers) {
            return res.status(403).json({ error: USER_LIMIT_MESSAGE });
        }

        const nextData = {
            admin: mergeAdminPassword(incoming.admin, current.admin),
            users: nextUsers
        };

        const saved = await saveData(nextData);
        const users = saved.users.map(enrichUserSession);
        res.json({
            success: true,
            data: {
                admin: stripAdminForResponse(saved.admin),
                users: users.map(stripUserForAdmin),
                limits: {
                    maxUsers: maxUsers,
                    userCount: saved.users.length,
                    onlineCount: users.filter(function (user) {
                        return user.isOnline;
                    }).length
                }
            }
        });
    } catch (error) {
        return sendSafeError(res, 500, 'Unable to save changes.', error);
    }
});

router.post('/admin/reset', requireAdmin, async (req, res) => {
    try {
        const defaultData = require('../defaultData');
        const saved = await saveData(defaultData);
        const users = saved.users.map(enrichUserSession);
        res.json({
            success: true,
            data: {
                admin: stripAdminForResponse(saved.admin),
                users: users.map(stripUserForAdmin),
                limits: {
                    maxUsers: getMaxUsers(),
                    userCount: saved.users.length,
                    onlineCount: users.filter(function (user) {
                        return user.isOnline;
                    }).length
                }
            }
        });
    } catch (error) {
        return sendSafeError(res, 500, 'Unable to restore defaults.', error);
    }
});

module.exports = router;
