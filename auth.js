(function () {
    const AUTH_KEY = 'boaLoggedIn';
    const USER_ID_KEY = 'boaUserId';
    const USER_TOKEN_KEY = 'boaUserToken';

    window.BoAAuth = {
        login: function (userId, token) {
            sessionStorage.setItem(AUTH_KEY, 'true');
            if (userId) {
                sessionStorage.setItem(USER_ID_KEY, userId);
            }
            if (token) {
                sessionStorage.setItem(USER_TOKEN_KEY, token);
            }
        },
        logout: function () {
            sessionStorage.removeItem(AUTH_KEY);
            sessionStorage.removeItem(USER_ID_KEY);
            sessionStorage.removeItem(USER_TOKEN_KEY);
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
        requireAuth: function () {
            if (!this.isLoggedIn()) {
                window.location.replace('index.html');
                return false;
            }
            return true;
        }
    };
})();
