function isAdminEnvConfigured() {
    return !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}

function getAdminUsername() {
    return process.env.ADMIN_USERNAME || '';
}

function getAdminPassword() {
    return process.env.ADMIN_PASSWORD || '';
}

function getAdminForResponse(storedAdmin) {
    if (isAdminEnvConfigured()) {
        return {
            username: getAdminUsername(),
            hasPassword: true,
            managedByEnv: true
        };
    }

    return {
        username: storedAdmin?.username || '',
        hasPassword: !!storedAdmin?.password,
        managedByEnv: false
    };
}

async function validateAdminEnvLogin(username, password) {
    if (!isAdminEnvConfigured()) {
        return null;
    }

    const envUsername = getAdminUsername();
    const envPassword = getAdminPassword();
    if (username !== envUsername || password !== envPassword) {
        return false;
    }

    return true;
}

module.exports = {
    isAdminEnvConfigured,
    getAdminUsername,
    getAdminPassword,
    getAdminForResponse,
    validateAdminEnvLogin
};
