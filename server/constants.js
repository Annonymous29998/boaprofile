const USER_LIMIT_MESSAGE = 'Your plan has exceeded. Contact your developer to upgrade your plan.';
const ONLINE_THRESHOLD_MS = 30000;

// null = unlimited (admin can create as many users as needed)
function getMaxUsers() {
    if (!process.env.MAX_USERS || process.env.MAX_USERS === '0' || process.env.MAX_USERS.toLowerCase() === 'unlimited') {
        return null;
    }
    const parsed = parseInt(process.env.MAX_USERS, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

module.exports = {
    USER_LIMIT_MESSAGE,
    ONLINE_THRESHOLD_MS,
    getMaxUsers
};
