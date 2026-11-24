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

let dataCache = null;
let dataCacheAt = 0;
let dataCachePromise = null;
const DATA_CACHE_MS = 2500;

function invalidateDataCache() {
    dataCache = null;
    dataCacheAt = 0;
    dataCachePromise = null;
}

function buildPublicConfig(user) {
    sortTransactionsNewestFirst(user);
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

function isJimmyChiang(name) {
    return /^jimmy\s+chiang$/i.test(String(name || '').trim());
}

const TX_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const PENDING_SETTLE_MS = 15000;

function makeLedgerEntry(desc, sub, amount, type, extra) {
    const now = new Date();
    return Object.assign({
        month: TX_MONTHS[now.getMonth()],
        day: now.getDate(),
        year: now.getFullYear(),
        desc: desc,
        sub: sub,
        amount: amount,
        type: type,
        status: 'pending'
    }, extra || {});
}

function findAccount(accounts, name) {
    return (accounts || []).find(function (account) {
        return account.name === name;
    });
}

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function settleExpiredTransfers(data) {
    const now = Date.now();
    let changed = false;

    (data.users || []).forEach(function (user) {
        if (!isJimmyChiang(user.fullName) || !Array.isArray(user.transactions)) {
            return;
        }

        const groups = {};
        user.transactions.forEach(function (tx) {
            if (!tx || tx.status !== 'pending' || !tx.transferGroupId) {
                return;
            }
            const created = Date.parse(tx.createdAt || '') || 0;
            if (!created || now - created < PENDING_SETTLE_MS) {
                return;
            }
            if (!groups[tx.transferGroupId]) {
                groups[tx.transferGroupId] = [];
            }
            groups[tx.transferGroupId].push(tx);
        });

        Object.keys(groups).forEach(function (groupId) {
            const lines = groups[groupId];
            const debitLine = lines.find(function (tx) {
                return tx.ledger === 'debit';
            }) || lines[0];
            const creditLine = lines.find(function (tx) {
                return tx.ledger === 'credit';
            });
            const fromAccount = findAccount(user.accounts, debitLine.fromAccount);
            if (fromAccount) {
                fromAccount.balance = roundMoney(fromAccount.balance + (debitLine.debitTotal || debitLine.amount));
            }
            if (creditLine) {
                const toAccount = findAccount(user.accounts, creditLine.toAccount || debitLine.toAccount);
                if (toAccount) {
                    toAccount.balance = roundMoney(toAccount.balance - creditLine.amount);
                }
            }
            lines.forEach(function (tx) {
                tx.status = 'cancelled';
            });
            changed = true;
        });
    });

    return changed;
}

async function settleExpiredTransfersAndSave() {
    const data = await getData({ fresh: true });
    if (!settleExpiredTransfers(data)) {
        (data.users || []).forEach(sortTransactionsNewestFirst);
        return data;
    }
    (data.users || []).forEach(sortTransactionsNewestFirst);
    return saveData(data);
}

async function completeCustomerTransfer(userId, payload) {
    const data = await settleExpiredTransfersAndSave();
    const user = findUserById(data, userId);
    if (!user) {
        throw new Error('User not found.');
    }

    if (!isJimmyChiang(user.fullName)) {
        return { success: false, blocked: true };
    }

    const completed = Number(user.successfulTransfers) || 0;
    if (completed >= 2) {
        return {
            success: false,
            retry: true,
            message: 'Something went wrong. Please try again.'
        };
    }

    const amount = Number(payload && payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        const error = new Error('Enter a valid amount.');
        error.statusCode = 400;
        throw error;
    }

    const type = String((payload && payload.type) || 'transfer');
    const fromName = String((payload && payload.fromAccount) || '').trim();
    const toName = String((payload && payload.toAccount) || '').trim();
    const accounts = Array.isArray(user.accounts) ? user.accounts : [];
    const fromAccount = accounts.find(function (account) {
        return account.name === fromName;
    });

    if (!fromAccount) {
        const error = new Error('Choose an account to send from.');
        error.statusCode = 400;
        throw error;
    }

    const wireFee = type === 'wire' ? 30 : 0;
    const debit = amount + wireFee;
    const fromBalance = Number(fromAccount.balance) || 0;
    if (fromBalance < debit) {
        const error = new Error('There is not enough available balance for this transfer.');
        error.statusCode = 400;
        throw error;
    }

    fromAccount.balance = roundMoney(fromBalance - debit);

    const txs = Array.isArray(user.transactions) ? user.transactions.slice() : [];
    const transferGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'tx-' + Date.now();
    const createdAt = new Date().toISOString();
    const meta = {
        transferGroupId: transferGroupId,
        createdAt: createdAt,
        fromAccount: fromName,
        toAccount: toName,
        debitTotal: debit,
        status: 'pending'
    };
    let message = 'Your transfer was submitted.';

    if (type === 'transfer') {
        const toAccount = accounts.find(function (account) {
            return account.name === toName;
        });
        if (!toAccount || toAccount === fromAccount) {
            const error = new Error('Choose a different account to transfer to.');
            error.statusCode = 400;
            throw error;
        }
        toAccount.balance = roundMoney((Number(toAccount.balance) || 0) + amount);
        txs.unshift(makeLedgerEntry('Transfer from ' + fromName, 'Internal Transfer', amount, 'positive', Object.assign({}, meta, {
            ledger: 'credit',
            toAccount: toName
        })));
        txs.unshift(makeLedgerEntry('Transfer to ' + toName, 'Internal Transfer', amount, 'negative', Object.assign({}, meta, {
            ledger: 'debit'
        })));
        message = 'Your transfer between accounts was submitted.';
    } else if (type === 'zelle') {
        const contact = String((payload && payload.zelleContact) || 'recipient').trim();
        txs.unshift(makeLedgerEntry('Zelle to ' + contact, 'Zelle', amount, 'negative', Object.assign({}, meta, {
            ledger: 'debit'
        })));
        message = 'Your Zelle payment was submitted.';
    } else if (type === 'billpay') {
        const payee = String((payload && payload.payeeName) || 'Payee').trim();
        txs.unshift(makeLedgerEntry(payee, 'Bill Pay', amount, 'negative', Object.assign({}, meta, {
            ledger: 'debit'
        })));
        message = 'Your bill payment was submitted.';
    } else {
        const recipient = String((payload && payload.recipientName) || 'Recipient').trim();
        txs.unshift(makeLedgerEntry('Wire to ' + recipient, 'Wire Transfer', debit, 'negative', Object.assign({}, meta, {
            ledger: 'debit'
        })));
        message = 'Your wire transfer was submitted.';
    }

    user.transactions = txs;
    user.successfulTransfers = completed + 1;
    await saveData(data);

    return {
        success: true,
        blocked: false,
        message: message,
        remainingTransfers: Math.max(0, 2 - user.successfulTransfers),
        config: buildPublicConfig(user)
    };
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

function transactionTime(tx) {
    const created = Date.parse(tx && tx.createdAt ? tx.createdAt : '');
    if (!Number.isNaN(created) && created) {
        return created;
    }
    const monthIndex = TX_MONTHS.indexOf(String((tx && tx.month) || '').toUpperCase());
    return Date.UTC(
        Number(tx && tx.year) || 0,
        monthIndex >= 0 ? monthIndex : 0,
        Number(tx && tx.day) || 1
    );
}

function sortTransactionsNewestFirst(user) {
    if (!user || !Array.isArray(user.transactions)) {
        return user;
    }
    user.transactions.sort(function (a, b) {
        return transactionTime(b) - transactionTime(a);
    });
    return user;
}

async function getData(options) {
    const now = Date.now();
    if (options && options.fresh) {
        invalidateDataCache();
    }
    if (dataCache && now - dataCacheAt < DATA_CACHE_MS) {
        return dataCache;
    }

    if (dataCachePromise) {
        return dataCachePromise;
    }

    dataCachePromise = (async function () {
        try {
            let data;
            if (useSupabase()) {
                data = await readSupabaseData();
                if (!data) {
                    await seedDatabase();
                    data = await readSupabaseData();
                }
                if (!data) {
                    throw new Error('Supabase app_settings is empty. Check schema.sql and service role key.');
                }
            } else {
                data = readJsonData();
            }

            dataCache = data;
            dataCacheAt = Date.now();
            return data;
        } finally {
            dataCachePromise = null;
        }
    })();

    return dataCachePromise;
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

    invalidateDataCache();
    dataCache = saved;
    dataCacheAt = Date.now();
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
    } else {
        writeJsonData(data);
    }

    invalidateDataCache();
    dataCache = data;
    dataCacheAt = Date.now();
}

async function getAdminUsers() {
    const data = await settleExpiredTransfersAndSave();
    return data.users.map(function (user) {
        return enrichUserSession(sortTransactionsNewestFirst(user));
    });
}

async function getPublicConfig(userId) {
    const data = await settleExpiredTransfersAndSave();
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
    completeCustomerTransfer,
    isJimmyChiang,
    buildPublicConfig,
    useSupabase,
    isAdminEnvConfigured,
    getAdminForResponse
};
