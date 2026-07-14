(function () {
    const AUTH_KEY = 'boaLoggedIn';
    const USER_KEY = 'boaCurrentUser';

    const USERS = {
        meganwoods: {
            id: 'meganwoods',
            username: 'meganwoods',
            password: 'Jesus@2001',
            name: 'Megan Woods',
            currentBalance: '$700,000.00',
            savingsBalance: '$50,000.00',
            settlementFee: '$25,000.00',
            pendingAmount: null
        },
        A_Eugene89: {
            id: 'A_Eugene89',
            username: 'A_Eugene89',
            password: 'Living!onlove',
            name: 'Alan E. Jackson',
            currentBalance: '$1,800,000.00',
            savingsBalance: '$50,000.00',
            settlementFee: '$17,000.00',
            pendingAmount: '$17,000.00'
        }
    };

    function findUser(username, password) {
        var key;
        for (key in USERS) {
            if (!Object.prototype.hasOwnProperty.call(USERS, key)) {
                continue;
            }
            var user = USERS[key];
            if (user.username === username && user.password === password) {
                return user;
            }
        }
        return null;
    }

    window.BoAAuth = {
        users: USERS,
        authenticate: function (username, password) {
            return findUser(username, password);
        },
        login: function (userOrId) {
            var user = typeof userOrId === 'string' ? USERS[userOrId] : userOrId;
            if (!user) {
                return false;
            }
            sessionStorage.setItem(AUTH_KEY, 'true');
            sessionStorage.setItem(USER_KEY, user.id);
            return true;
        },
        logout: function () {
            sessionStorage.removeItem(AUTH_KEY);
            sessionStorage.removeItem(USER_KEY);
        },
        isLoggedIn: function () {
            return sessionStorage.getItem(AUTH_KEY) === 'true' && !!this.getUser();
        },
        getUser: function () {
            var id = sessionStorage.getItem(USER_KEY);
            return id && USERS[id] ? USERS[id] : null;
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
