(function () {
    const AUTH_KEY = 'boaLoggedIn';
    const USER_ID_KEY = 'boaUserId';
    const USER_TOKEN_KEY = 'boaUserToken';
    const ACTIVITY_KEY = 'boaLastActivityAt';
    const EXPIRED_KEY = 'boaSessionExpired';
    const IDLE_MS = 10 * 60 * 1000;
    const ACTIVITY_EVENTS = ['click', 'keydown', 'touchstart', 'scroll', 'mousemove'];

    let idleTimer = null;

    function markActivity() {
        sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
        scheduleIdleCheck();
    }

    function expireSession() {
        sessionStorage.setItem(EXPIRED_KEY, '1');
        window.BoAAuth.logout();
        window.location.replace('index.html');
    }

    function scheduleIdleCheck() {
        if (idleTimer) {
            clearTimeout(idleTimer);
        }
        const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || Date.now());
        const remaining = IDLE_MS - (Date.now() - last);
        if (remaining <= 0) {
            expireSession();
            return;
        }
        idleTimer = setTimeout(expireSession, remaining);
    }

    function startIdleWatch() {
        markActivity();
        ACTIVITY_EVENTS.forEach(function (eventName) {
            document.addEventListener(eventName, markActivity, { passive: true });
        });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') {
                const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
                if (Date.now() - last >= IDLE_MS) {
                    expireSession();
                } else {
                    scheduleIdleCheck();
                }
            }
        });
        scheduleIdleCheck();
    }

    window.BoAAuth = {
        login: function (userId, token) {
            sessionStorage.setItem(AUTH_KEY, 'true');
            if (userId) {
                sessionStorage.setItem(USER_ID_KEY, userId);
            }
            if (token) {
                sessionStorage.setItem(USER_TOKEN_KEY, token);
            }
            sessionStorage.removeItem(EXPIRED_KEY);
            markActivity();
        },
        logout: function () {
            sessionStorage.removeItem(AUTH_KEY);
            sessionStorage.removeItem(USER_ID_KEY);
            sessionStorage.removeItem(USER_TOKEN_KEY);
            sessionStorage.removeItem(ACTIVITY_KEY);
            sessionStorage.removeItem('boaConfigCache');
            if (window.BoAConfig && typeof window.BoAConfig.clearCache === 'function') {
                window.BoAConfig.clearCache();
            }
            if (idleTimer) {
                clearTimeout(idleTimer);
                idleTimer = null;
            }
        },
        isLoggedIn: function () {
            return sessionStorage.getItem(AUTH_KEY) === 'true' && !!this.getToken();
        },
        getUserId: function () {
            return sessionStorage.getItem(USER_ID_KEY);
        },
        getToken: function () {
            return sessionStorage.getItem(USER_TOKEN_KEY);
        },
        consumeSessionExpired: function () {
            if (sessionStorage.getItem(EXPIRED_KEY) === '1') {
                sessionStorage.removeItem(EXPIRED_KEY);
                return true;
            }
            return false;
        },
        requireAuth: function () {
            if (!this.isLoggedIn()) {
                window.location.replace('index.html');
                return false;
            }
            const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
            if (last && Date.now() - last >= IDLE_MS) {
                expireSession();
                return false;
            }
            startIdleWatch();
            return true;
        }
    };
})();
