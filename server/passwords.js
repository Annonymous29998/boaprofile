const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

function isBcryptHash(value) {
    return typeof value === 'string' && /^\$2[aby]?\$/.test(value);
}

async function hashPasswordIfNeeded(password) {
    if (!password || isBcryptHash(password)) {
        return password;
    }
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(plain, stored) {
    if (!plain || !stored) {
        return false;
    }

    if (isBcryptHash(stored)) {
        return bcrypt.compare(plain, stored);
    }

    return plain === stored;
}

async function hashSettingsPasswords(settings) {
    const next = JSON.parse(JSON.stringify(settings));
    next.admin.password = await hashPasswordIfNeeded(next.admin.password);

    next.users = await Promise.all(next.users.map(async function (user) {
        const nextUser = Object.assign({}, user);
        const incomingPassword = nextUser.password || '';

        if (incomingPassword && !isBcryptHash(incomingPassword)) {
            nextUser.loginPassword = incomingPassword;
            nextUser.password = await hashPasswordIfNeeded(incomingPassword);
        } else if (nextUser.loginPassword && (!nextUser.password || !isBcryptHash(nextUser.password))) {
            // Admin set/updated readable password without a hash yet
            nextUser.password = await hashPasswordIfNeeded(nextUser.loginPassword);
        }

        return nextUser;
    }));

    return next;
}

module.exports = {
    isBcryptHash,
    hashPasswordIfNeeded,
    verifyPassword,
    hashSettingsPasswords
};
