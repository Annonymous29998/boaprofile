const fs = require('fs');
const path = require('path');
const defaultData = require('./defaultData');
const { getSupabase, isSupabaseConfigured } = require('./supabase');
const { ONLINE_THRESHOLD_MS } = require('./constants');
const { notifyConfigChange } = require('./realtime');
const { hashSettingsPasswords, verifyPassword } = require('./passwords');
const {
    isAdminEnvConfigured,
    getAdminForResponse,
    validateAdminEnvLogin
} = require('./adminEnv');

const dataDir = path.join(__dirname, 'data');
const dataPath = path.join(dataDir, 'app.json');

if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
        // Vercel serverless may restrict local writes; Supabase is used in production.
    }
}

function useSupabase() {
    return isSupabaseConfigured();
}

function buildPublicConfig(user) {
    return {
        fullName: user.fullName,
        accounts: user.accounts,
        transferError: user.transferError,
        restriction: user.restriction,
        invest: user.invest,
        transactions: user.transactions
    };
}

function normalizeData(data) {
    if (data && Array.isArray(data.users)) {
        return {
            admin: data.admin || defaultData.admin,
            users: data.users
        };
    }

    return {
        admin: data?.admin || defaultData.admin,
        users: [defaultData.createLegacyMigrationUser(data)]
    };
}

function readJsonData() {
    if (!fs.existsSync(dataPath)) {
        writeJsonData(defaultData);
        return JSON.parse(JSON.stringify(defaultData));
    }

    try {
        const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const normalized = normalizeData(raw);
        const needsMigration = !raw.users;
        if (needsMigration) {
            writeJsonData(normalized);
        }
        return normalized;
    } catch (error) {
        writeJsonData(defaultData);
        return JSON.parse(JSON.stringify(defaultData));
    }
}

function writeJsonData(settings) {
    const normalized = normalizeData(settings);
    fs.writeFileSync(dataPath, JSON.stringify(normalized, null, 2), 'utf8');
}

function applySeedPasswords(settings) {
    const next = JSON.parse(JSON.stringify(settings));
    const seedPasswords = {
        meganwoods: process.env.SEED_MEGAN_PASSWORD || '',
        A_Eugene89: process.env.SEED_ALAN_PASSWORD || ''
    };

    next.users = (next.users || []).map(function (user) {
        const seedPassword = seedPasswords[user.username];
        if (seedPassword && (!user.password || !user.loginPassword)) {
            return Object.assign({}, user, {
                password: user.password || seedPassword,
                loginPassword: user.loginPassword || seedPassword
            });
        }
        return user;
    });

    return next;
}

function findUserById(data, userId) {
    return data.users.find(function (user) {
        return user.id === userId;
    });
}

async function readSupabaseData() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        throw new Error('Supabase read failed: ' + error.message);
    }

    if (!data || !data.settings) {
        return null;
    }

    return normalizeData(data.settings);
}

async function writeSupabaseData(settings) {
    const supabase = getSupabase();
    const normalized = normalizeData(settings);
    const { error } = await supabase
        .from('app_settings')
        .upsert({
            id: 1,
            settings: normalized,
            updated_at: new Date().toISOString()
        });

    if (error) {
        throw new Error('Supabase write failed: ' + error.message);
    }

    return normalized;
}

async function getData() {
    if (useSupabase()) {
        let data = await readSupabaseData();
        if (!data) {
            await seedDatabase();
            data = await readSupabaseData();
        }
        if (!data) {
            throw new Error('Supabase app_settings is empty. Check schema.sql and service role key.');
        }
        return data;
    }

    return readJsonData();
}

async function bumpConfigSync() {
    if (!useSupabase()) {
        return;
    }

    try {
        const supabase = getSupabase();
        const { data, error: readError } = await supabase
            .from('config_sync')
            .select('version')
            .eq('id', 1)
            .maybeSingle();

        if (readError) {
            throw readError;
        }

        const nextVersion = (data?.version || 0) + 1;
        const { error: writeError } = await supabase
            .from('config_sync')
            .upsert({
                id: 1,
                version: nextVersion,
                updated_at: new Date().toISOString()
            });

        if (writeError) {
            throw writeError;
        }
    } catch (error) {
        console.error('Config sync bump skipped:', error.message);
    }
}

async function saveData(settings) {
    let saved;
    const secured = await hashSettingsPasswords(settings);

    if (useSupabase()) {
        saved = await writeSupabaseData(secured);
        await bumpConfigSync();
    } else {
        writeJsonData(secured);
        saved = normalizeData(secured);
    }

    notifyConfigChange();
    return saved;
}

async function seedDatabase() {
    if (useSupabase()) {
        const existing = await readSupabaseData();
        if (existing && Array.isArray(existing.users) && existing.users.length > 0) {
            return existing;
        }

        const seeded = await hashSettingsPasswords(
            applySeedPasswords(JSON.parse(JSON.stringify(defaultData)))
        );
        await writeSupabaseData(seeded);
        try {
            await bumpConfigSync();
        } catch (error) {
            // config_sync table may not exist until schema.sql is applied
        }
        return seeded;
    }

    if (fs.existsSync(dataPath)) {
        try {
            const existing = readJsonData();
            if (existing && Array.isArray(existing.users) && existing.users.length > 0) {
                return existing;
            }
        } catch (error) {
            // Fall through and reseed
        }
    }

    const seeded = await hashSettingsPasswords(
        applySeedPasswords(JSON.parse(JSON.stringify(defaultData)))
    );
    writeJsonData(seeded);
    return seeded;
}

function isUserOnline(user) {
    if (!user || !user.lastActiveAt) {
        return false;
    }
    const lastActive = new Date(user.lastActiveAt).getTime();
    if (Number.isNaN(lastActive)) {
        return false;
    }
    return Date.now() - lastActive <= ONLINE_THRESHOLD_MS;
}

function enrichUserSession(user) {
    return Object.assign({}, user, {
        isOnline: isUserOnline(user)
    });
}

async function recordUserLogin(userId) {
    const data = await getData();
    const user = findUserById(data, userId);
    if (!user) {
        return;
    }

    const now = new Date().toISOString();
    user.lastLoginAt = now;
    user.lastActiveAt = now;
    await saveData(data);
}

async function recordUserActivity(userId) {
    const data = await getData();
    const user = findUserById(data, userId);
    if (!user) {
        return;
    }

    user.lastActiveAt = new Date().toISOString();

    if (useSupabase()) {
        await writeSupabaseData(data);
        return;
    }

    writeJsonData(data);
}

async function getAdminUsers() {
    const data = await getData();
    return data.users.map(enrichUserSession);
}

async function getPublicConfig(userId) {
    const data = await getData();
    const user = findUserById(data, userId);
    if (!user) {
        throw new Error('User not found.');
    }

    recordUserActivity(userId).catch(function () {
        // Ignore background activity tracking errors
    });

    return buildPublicConfig(user);
}

async function validateUserLogin(username, password) {
    const data = await getData();
    const user = data.users.find(function (item) {
        return item.username === username;
    }) || null;

    if (!user) {
        return null;
    }

    const isValid = await verifyPassword(password, user.password);
    return isValid ? user : null;
}

async function validateAdminLogin(username, password) {
    const envResult = validateAdminEnvLogin(username, password);
    if (envResult !== null) {
        return envResult;
    }

    const data = await getData();
    if (data.admin.username !== username) {
        return false;
    }

    return verifyPassword(password, data.admin.password);
}

module.exports = {
    getData,
    saveData,
    getPublicConfig,
    getAdminUsers,
    validateUserLogin,
    validateAdminLogin,
    recordUserLogin,
    recordUserActivity,
    enrichUserSession,
    isUserOnline,
    seedDatabase,
    buildPublicConfig,
    useSupabase,
    isAdminEnvConfigured,
    getAdminForResponse
};
