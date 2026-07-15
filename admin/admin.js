const API_BASE = '/api';
const TOKEN_KEY = 'boaAdminToken';
const USER_LIMIT_MESSAGE = 'Your plan has exceeded. Contact your developer to upgrade your plan.';

let appData = null;
let selectedUserId = null;
let userLimits = { maxUsers: null, userCount: 0, onlineCount: 0 };
let sessionRefreshTimer = null;

const sections = {
    overview: { title: 'Overview', subtitle: 'Summary for the selected customer account' },
    users: { title: 'Users', subtitle: 'Create customers, set login, balances, and transfer message' },
    accounts: { title: 'Accounts', subtitle: 'Advanced: add or edit additional accounts' },
    transactions: { title: 'Transactions', subtitle: 'Edit pay and transfer history for the selected user' },
    messages: { title: 'Account Restricted', subtitle: 'Edit the full restriction popup for the selected customer' },
    invest: { title: 'Investments', subtitle: 'Manage portfolio summary and holdings' },
    security: { title: 'Admin Security', subtitle: 'Update admin console login credentials' }
};

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

function formatRelativeTime(isoString) {
    if (!isoString) {
        return 'Never';
    }

    const timestamp = new Date(isoString).getTime();
    if (Number.isNaN(timestamp)) {
        return 'Unknown';
    }

    const diffMs = Date.now() - timestamp;
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));

    if (diffSec < 60) {
        return 'Just now';
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return diffMin + ' min ago';
    }

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) {
        return diffHr + ' hr ago';
    }

    const diffDay = Math.floor(diffHr / 24);
    return diffDay + ' day' + (diffDay === 1 ? '' : 's') + ' ago';
}

function getSessionBadgeHtml(user) {
    if (user.isOnline) {
        return '<span class="session-badge online">Online</span>';
    }
    return '<span class="session-badge offline">Offline</span>';
}

function updateSessionFields(user) {
    const statusEl = document.getElementById('overviewStatus');
    const lastLoginEl = document.getElementById('overviewLastLogin');
    const onlineCountEl = document.getElementById('statOnlineCount');

    if (statusEl) {
        statusEl.className = 'session-badge ' + (user.isOnline ? 'online' : 'offline');
        statusEl.textContent = user.isOnline ? 'Online now' : 'Offline';
    }

    if (lastLoginEl) {
        lastLoginEl.textContent = user.lastLoginAt
            ? formatRelativeTime(user.lastLoginAt) + ' (' + new Date(user.lastLoginAt).toLocaleString() + ')'
            : 'Never logged in';
    }

    if (onlineCountEl) {
        onlineCountEl.textContent = String(userLimits.onlineCount || 0);
    }
}

async function refreshUserSessions() {
    if (!getToken() || !appData) {
        return;
    }

    const response = await apiRequest('/admin/data');
    userLimits = response.limits || userLimits;

    response.users.forEach(function (freshUser) {
        const existing = appData.users.find(function (user) {
            return user.id === freshUser.id;
        });
        if (existing) {
            existing.lastLoginAt = freshUser.lastLoginAt;
            existing.lastActiveAt = freshUser.lastActiveAt;
            existing.isOnline = freshUser.isOnline;
        }
    });

    renderUsersList();
    updateOverview();
    updateUserLimitUI();
}

function startSessionRefresh() {
    if (sessionRefreshTimer) {
        clearInterval(sessionRefreshTimer);
    }
    sessionRefreshTimer = setInterval(function () {
        refreshUserSessions().catch(function () {
            // Ignore background refresh errors
        });
    }, 10000);
}

function stopSessionRefresh() {
    if (sessionRefreshTimer) {
        clearInterval(sessionRefreshTimer);
        sessionRefreshTimer = null;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(Number(amount) || 0);
}

let toastTimer = null;

function showToast(message, isError) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
    }

    toast.textContent = message;
    toast.className = 'toast' + (isError ? ' toast-error' : ' toast-success') + ' is-visible';
    toast.setAttribute('role', isError ? 'alert' : 'status');

    toastTimer = setTimeout(function () {
        toast.classList.remove('is-visible');
        toastTimer = null;
    }, 3200);
}

function bindClick(id, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', handler);
    }
}

async function apiRequest(path, options) {
    const opts = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = getToken();
    if (token) {
        headers.Authorization = 'Bearer ' + token;
    }

    const response = await fetch(API_BASE + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body
    });

    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok) {
        const safeMessage = window.BoASecure
            ? window.BoASecure.toUserMessage({ message: data.error || data.message }, 'default')
            : 'Something went wrong. Please try again.';
        throw new Error(safeMessage);
    }

    return data;
}

function clearSessionPending() {
    document.documentElement.classList.remove('admin-session-pending');
}

function showBootLoader(show) {
    const loader = document.getElementById('adminBootLoader');
    if (loader) {
        loader.hidden = !show;
    }
}

function showLogin() {
    clearSessionPending();
    showBootLoader(false);
    stopSessionRefresh();
    const loginView = document.getElementById('loginView');
    const dashboardView = document.getElementById('dashboardView');
    if (loginView) {
        loginView.classList.remove('is-hidden');
        loginView.removeAttribute('hidden');
    }
    if (dashboardView) {
        dashboardView.classList.add('is-hidden');
        dashboardView.setAttribute('hidden', 'hidden');
    }
}

function showDashboard() {
    const loginView = document.getElementById('loginView');
    const dashboardView = document.getElementById('dashboardView');
    if (loginView) {
        loginView.classList.add('is-hidden');
        loginView.setAttribute('hidden', 'hidden');
    }
    if (dashboardView) {
        dashboardView.classList.remove('is-hidden');
        dashboardView.removeAttribute('hidden');
    }
}

function switchSection(sectionName) {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (button) {
        button.classList.toggle('active', button.dataset.section === sectionName);
    });
    document.querySelectorAll('.content-section').forEach(function (section) {
        section.classList.toggle('active', section.dataset.section === sectionName);
    });

    const meta = sections[sectionName];
    const title = document.getElementById('sectionTitle');
    const subtitle = document.getElementById('sectionSubtitle');
    if (title && meta) title.textContent = meta.title;
    if (subtitle && meta) subtitle.textContent = meta.subtitle;

    const mainPanel = document.querySelector('.main-panel');
    if (mainPanel) {
        mainPanel.scrollTop = 0;
    }

    closeMobileSidebar();
}

function findAccount(user, name) {
    return user.accounts.find(function (account) {
        return account.name === name;
    });
}

function ensureAccount(user, name, balance) {
    const existing = findAccount(user, name);
    if (existing) {
        existing.balance = balance;
        return;
    }
    user.accounts.push({ name: name, balance: balance });
}

function syncQuickBalancesFromUser(user) {
    const current = findAccount(user, 'Current Account');
    const savings = findAccount(user, 'Savings Account');
    const checking = findAccount(user, 'Checking Account') || findAccount(user, 'Money Market Account');
    setFieldValue('currentAccountBalance', current ? current.balance : 0);
    setFieldValue('savingsAccountBalance', savings ? savings.balance : 0);
    setFieldValue('checkingAccountBalance', checking ? checking.balance : 0);
}

function syncQuickBalancesToUser(user) {
    const currentBal = parseFloat(document.getElementById('currentAccountBalance').value) || 0;
    const savingsBal = parseFloat(document.getElementById('savingsAccountBalance').value) || 0;
    const checkingBal = parseFloat(document.getElementById('checkingAccountBalance').value) || 0;

    ensureAccount(user, 'Current Account', currentBal);
    ensureAccount(user, 'Savings Account', savingsBal);

    // Drop legacy Money Market name; only keep Checking when it has a balance.
    user.accounts = (user.accounts || []).filter(function (account) {
        return account.name !== 'Money Market Account' && account.name !== 'Checking Account';
    });
    if (checkingBal > 0) {
        user.accounts.push({ name: 'Checking Account', balance: checkingBal });
    }
}

function canCreateUser() {
    if (userLimits.maxUsers == null) {
        return true;
    }
    return appData.users.length < userLimits.maxUsers;
}

function updateUserLimitUI() {
    const max = userLimits.maxUsers;
    const count = appData ? appData.users.length : 0;
    const limitLabel = document.getElementById('userLimitLabel');
    const createBtn = document.getElementById('createUserBtn');
    const statUserCount = document.getElementById('statUserCount');

    if (limitLabel) {
        limitLabel.textContent = max == null
            ? count + ' users (unlimited)'
            : count + ' of ' + max + ' users used';
    }
    if (statUserCount) {
        statUserCount.textContent = max == null ? String(count) : count + ' / ' + max;
    }
    if (createBtn) {
        const blocked = max != null && count >= max;
        createBtn.disabled = blocked;
        createBtn.title = blocked ? USER_LIMIT_MESSAGE : '';
    }

    const deleteBtn = document.getElementById('deleteUserBtn');
    if (deleteBtn) {
        deleteBtn.disabled = count <= 1;
        deleteBtn.title = count <= 1 ? 'At least one user must remain.' : 'Delete the selected user';
    }
}

function updateLoginUrl() {
    const loginUrlEl = document.getElementById('customerLoginUrl');
    if (loginUrlEl) {
        loginUrlEl.textContent = window.location.origin + '/index.html';
    }
}

function applyServerPayload(payload) {
    appData = {
        admin: payload.admin,
        users: payload.users || []
    };
    userLimits = payload.limits || {
        maxUsers: null,
        userCount: appData.users.length,
        onlineCount: 0
    };
}

function getSelectedUser() {
    if (!appData || !Array.isArray(appData.users)) {
        return null;
    }
    return appData.users.find(function (user) {
        return user.id === selectedUserId;
    }) || appData.users[0] || null;
}

function ensureUserShape(user) {
    user.accounts = user.accounts || [];
    user.transactions = user.transactions || [];
    user.username = user.username || '';
    user.loginPassword = user.loginPassword || '';
    user.transferError = user.transferError || { title: 'Error', message: '', button: 'Retry' };
    user.restriction = normalizeRestriction(user.restriction);
    user.invest = user.invest || { totalValue: 0, changeAmount: 0, changePercent: 0, holdings: [] };
    user.invest.holdings = user.invest.holdings || [];
    return user;
}

function defaultRestriction() {
    return {
        title: 'Account Restricted',
        greeting: 'Dear {name},',
        message: 'Your account is temporarily restricted due to unresolved security issues.',
        feeText: 'A settlement fee of {fee} is required to restore full access and remove the restriction, so normal account operations will be restored.',
        button: 'I Understand',
        support: 'Contact Support',
        settlementFee: 25000
    };
}

function normalizeRestriction(restriction) {
    const defaults = defaultRestriction();
    const next = Object.assign({}, defaults, restriction || {});
    next.settlementFee = Number(next.settlementFee) || 0;
    if (!next.title) next.title = defaults.title;
    if (!next.greeting) next.greeting = defaults.greeting;
    if (!next.feeText) next.feeText = defaults.feeText;
    if (!next.button) next.button = defaults.button;
    if (!next.support) next.support = defaults.support;
    return next;
}

function fillRestrictionPlaceholders(template, name, feeFormatted) {
    return String(template || '')
        .replace(/\{name\}/gi, name || 'Customer')
        .replace(/\{fee\}/gi, feeFormatted || '$0.00');
}

function updateRestrictionPreview() {
    const user = getSelectedUser();
    const name = (user && user.fullName) || 'Customer';
    const feeValue = document.getElementById('settlementFee') ? document.getElementById('settlementFee').value : '0';
    const fee = formatCurrency(parseFloat(feeValue) || 0);
    const title = (document.getElementById('restrictionTitle') || {}).value;
    const greetingRaw = (document.getElementById('restrictionGreeting') || {}).value;
    const message = (document.getElementById('restrictionMessage') || {}).value || '';
    const feeTextRaw = (document.getElementById('restrictionFeeText') || {}).value;
    const button = (document.getElementById('restrictionButton') || {}).value;
    const support = (document.getElementById('restrictionSupport') || {}).value;

    const greeting = fillRestrictionPlaceholders(String(greetingRaw || 'Dear {name},').trim(), name, fee);
    const feeText = fillRestrictionPlaceholders(
        String(feeTextRaw || 'A settlement fee of {fee} is required to restore full access and remove the restriction, so normal account operations will be restored.').trim(),
        name,
        fee
    );

    const titleEl = document.getElementById('restrictionPreviewTitle');
    const bodyEl = document.getElementById('restrictionPreviewBody');
    const buttonEl = document.getElementById('restrictionPreviewButton');
    const supportEl = document.getElementById('restrictionPreviewSupport');
    if (titleEl) titleEl.textContent = String(title || 'Account Restricted').trim();
    if (bodyEl) {
        const safeFeeHtml = feeText.split(fee).join('<strong style="color:#E31837;">' + fee + '</strong>');
        bodyEl.innerHTML =
            greeting.replace(/\n/g, '<br>') + '<br><br>' +
            String(message).replace(/\n/g, '<br>') + '<br><br>' +
            safeFeeHtml;
    }
    if (buttonEl) buttonEl.textContent = String(button || 'I Understand').trim();
    if (supportEl) supportEl.textContent = String(support || 'Contact Support').trim();

    const hintFee = document.getElementById('usersSettlementFeeHint');
    const hintMsg = document.getElementById('usersRestrictionMessageHint');
    if (hintFee) hintFee.value = feeValue;
    if (hintMsg) hintMsg.value = message;
}

function createBlankUser() {
    const suffix = Date.now();
    return {
        id: 'user-' + suffix,
        fullName: 'New Customer',
        username: 'user' + suffix,
        password: '',
        loginPassword: '',
        accounts: [
            { name: 'Current Account', balance: 0 },
            { name: 'Savings Account', balance: 0 }
        ],
        transferError: {
            title: 'Error',
            message: "We're sorry, we weren't able to complete your request. Please try again.",
            button: 'Retry'
        },
        restriction: defaultRestriction(),
        invest: {
            totalValue: 0,
            changeAmount: 0,
            changePercent: 0,
            holdings: []
        },
        transactions: [],
        lastLoginAt: null,
        lastActiveAt: null
    };
}

function setFieldValue(id, value) {
    const field = document.getElementById(id);
    if (field) {
        field.value = value;
    }
}

function collectFormData() {
    const user = getSelectedUser();
    if (!user) {
        return;
    }

    document.querySelectorAll('#accountsList .stack-item').forEach(function (row, index) {
        user.accounts[index] = {
            name: row.querySelector('.account-name').value.trim(),
            balance: parseFloat(row.querySelector('.account-balance').value) || 0
        };
    });

    document.querySelectorAll('#holdingsList .stack-item').forEach(function (row, index) {
        user.invest.holdings[index] = {
            name: row.querySelector('.holding-name').value.trim(),
            symbol: row.querySelector('.holding-symbol').value.trim(),
            value: parseFloat(row.querySelector('.holding-value').value) || 0,
            change: parseFloat(row.querySelector('.holding-change').value) || 0
        };
    });

    document.querySelectorAll('#transactionsTable tr').forEach(function (row, index) {
        user.transactions[index] = {
            month: row.querySelector('.tx-month').value.trim().toUpperCase(),
            day: parseInt(row.querySelector('.tx-day').value, 10) || 1,
            year: parseInt(row.querySelector('.tx-year').value, 10) || new Date().getFullYear(),
            desc: row.querySelector('.tx-desc').value.trim(),
            sub: row.querySelector('.tx-sub').value.trim(),
            amount: parseFloat(row.querySelector('.tx-amount').value) || 0,
            type: row.querySelector('.tx-type').value
        };
    });

    user.fullName = document.getElementById('fullName').value.trim();
    user.username = document.getElementById('userProfileUsername').value.trim();
    const newUserPassword = document.getElementById('userProfilePassword').value.trim();
    user.loginPassword = newUserPassword;
    if (newUserPassword) {
        // Plain password — server hashes it and keeps loginPassword for admin display
        user.password = newUserPassword;
    } else {
        delete user.password;
    }
    syncQuickBalancesToUser(user);
    // Keep transferError for API shape; Pay & Transfer uses Account Restricted instead.
    user.transferError = user.transferError || {
        title: 'Error',
        message: "We're sorry, we weren't able to complete your request. Please try again.",
        button: 'Retry'
    };
    user.restriction = normalizeRestriction({
        title: document.getElementById('restrictionTitle').value.trim(),
        greeting: document.getElementById('restrictionGreeting').value.trim(),
        message: document.getElementById('restrictionMessage').value.trim(),
        feeText: document.getElementById('restrictionFeeText').value.trim(),
        button: document.getElementById('restrictionButton').value.trim(),
        support: document.getElementById('restrictionSupport').value.trim(),
        settlementFee: parseFloat(document.getElementById('settlementFee').value) || 0
    });
    updateRestrictionPreview();
    user.invest.totalValue = parseFloat(document.getElementById('investTotalValue').value) || 0;
    user.invest.changeAmount = parseFloat(document.getElementById('investChangeAmount').value) || 0;
    user.invest.changePercent = parseFloat(document.getElementById('investChangePercent').value) || 0;

    appData.admin.username = document.getElementById('adminUsername').value.trim();
    if (!appData.admin.managedByEnv) {
        const newAdminPassword = document.getElementById('adminPassword').value.trim();
        if (newAdminPassword) {
            appData.admin.password = newAdminPassword;
        } else if (!appData.admin.password) {
            delete appData.admin.password;
        }
    } else {
        delete appData.admin.password;
    }
}

function updateOverview() {
    const user = getSelectedUser();
    if (!user) {
        return;
    }

    const totalBalance = user.accounts.reduce(function (sum, account) {
        return sum + Number(account.balance || 0);
    }, 0);

    document.getElementById('statTotalBalance').textContent = formatCurrency(totalBalance);
    document.getElementById('statAccountCount').textContent = String(user.accounts.length);
    document.getElementById('statTransactionCount').textContent = String(user.transactions.length);
    document.getElementById('statInvestValue').textContent = formatCurrency(user.invest.totalValue);
    document.getElementById('overviewName').textContent = user.fullName;
    updateSessionFields(user);
}

function renderUserSwitcher() {
    const select = document.getElementById('activeUserSelect');
    if (!select) {
        return;
    }

    select.innerHTML = appData.users.map(function (user) {
        const total = user.accounts.reduce(function (sum, account) {
            return sum + Number(account.balance || 0);
        }, 0);
        const selected = user.id === selectedUserId ? ' selected' : '';
        return '<option value="' + user.id + '"' + selected + '>' + user.fullName + ' (' + formatCurrency(total) + ')</option>';
    }).join('');
}

function renderUsersList() {
    const container = document.getElementById('usersList');
    if (!container) {
        return;
    }

    const canDelete = appData.users.length > 1;

    container.innerHTML = appData.users.map(function (user) {
        const total = user.accounts.reduce(function (sum, account) {
            return sum + Number(account.balance || 0);
        }, 0);
        const activeClass = user.id === selectedUserId ? ' active' : '';
        const deleteBtn = canDelete
            ? '<button type="button" class="user-delete-btn" data-user-id="' + user.id + '" title="Delete user" aria-label="Delete ' + user.fullName + '"><i class="fas fa-trash"></i></button>'
            : '';
        return (
            '<div class="user-card-wrap' + activeClass + '">' +
                deleteBtn +
                '<button type="button" class="user-card" data-user-id="' + user.id + '">' +
                    '<div class="user-card-top">' +
                        '<strong>' + user.fullName + '</strong>' +
                        getSessionBadgeHtml(user) +
                    '</div>' +
                    '<span class="user-username">@' + (user.username || 'no-username') + '</span>' +
                    '<em>' + formatCurrency(total) + '</em>' +
                    '<small class="user-last-login">' +
                        (user.lastLoginAt ? 'Last login: ' + formatRelativeTime(user.lastLoginAt) : 'Never logged in') +
                    '</small>' +
                '</button>' +
            '</div>'
        );
    }).join('');

    container.querySelectorAll('.user-card').forEach(function (button) {
        button.addEventListener('click', function () {
            collectFormData();
            selectedUserId = button.dataset.userId;
            populateForm();
        });
    });

    container.querySelectorAll('.user-delete-btn').forEach(function (button) {
        button.addEventListener('click', function (event) {
            event.stopPropagation();
            deleteUser(button.dataset.userId);
        });
    });
}

async function deleteUser(userId) {
    if (!appData || appData.users.length <= 1) {
        showToast('At least one user must remain.', true);
        return;
    }

    const user = appData.users.find(function (item) {
        return item.id === userId;
    });

    if (!user) {
        return;
    }

    if (!confirm('Delete user "' + user.fullName + '"? This cannot be undone.')) {
        return;
    }

    collectFormData();
    appData.users = appData.users.filter(function (item) {
        return item.id !== userId;
    });

    if (selectedUserId === userId) {
        selectedUserId = appData.users[0].id;
    }

    try {
        const result = await apiRequest('/admin/data', {
            method: 'PUT',
            body: JSON.stringify(appData)
        });
        applyServerPayload(result.data);
        populateForm();
        showToast('User deleted successfully.');
    } catch (err) {
        showToast(window.BoASecure ? window.BoASecure.toUserMessage(err, 'save') : 'Unable to save changes. Please try again.', true);
        await loadDashboard();
    }
}

function renderAccounts() {
    const user = getSelectedUser();
    const container = document.getElementById('accountsList');
    if (!container || !user) {
        return;
    }

    container.innerHTML = user.accounts.map(function (account, index) {
        return (
            '<div class="stack-item" data-index="' + index + '">' +
                '<div class="field">' +
                    '<label>Account Name</label>' +
                    '<input type="text" class="account-name" value="' + account.name + '">' +
                '</div>' +
                '<div class="field">' +
                    '<label>Balance ($)</label>' +
                    '<input type="number" class="account-balance" step="0.01" min="0" value="' + account.balance + '">' +
                '</div>' +
                '<button type="button" class="icon-btn remove-account" title="Remove account"><i class="fas fa-trash"></i></button>' +
            '</div>'
        );
    }).join('');

    container.querySelectorAll('.remove-account').forEach(function (button) {
        button.addEventListener('click', function () {
            if (user.accounts.length <= 1) {
                showToast('At least one account is required.', true);
                return;
            }
            const index = Number(button.closest('.stack-item').dataset.index);
            user.accounts.splice(index, 1);
            renderAccounts();
            updateOverview();
            renderUsersList();
            renderUserSwitcher();
        });
    });
}

function renderHoldings() {
    const user = getSelectedUser();
    const container = document.getElementById('holdingsList');
    if (!container || !user) {
        return;
    }

    container.innerHTML = user.invest.holdings.map(function (holding, index) {
        return (
            '<div class="stack-item" data-index="' + index + '">' +
                '<div class="field"><label>Name</label><input type="text" class="holding-name" value="' + holding.name + '"></div>' +
                '<div class="field"><label>Symbol</label><input type="text" class="holding-symbol" value="' + holding.symbol + '"></div>' +
                '<div class="field"><label>Value ($)</label><input type="number" class="holding-value" step="0.01" value="' + holding.value + '"></div>' +
                '<div class="field"><label>Change ($)</label><input type="number" class="holding-change" step="0.01" value="' + holding.change + '"></div>' +
                '<button type="button" class="icon-btn remove-holding" title="Remove holding"><i class="fas fa-trash"></i></button>' +
            '</div>'
        );
    }).join('');

    container.querySelectorAll('.remove-holding').forEach(function (button) {
        button.addEventListener('click', function () {
            const index = Number(button.closest('.stack-item').dataset.index);
            user.invest.holdings.splice(index, 1);
            renderHoldings();
        });
    });
}

function renderTransactions() {
    const user = getSelectedUser();
    const tbody = document.getElementById('transactionsTable');
    if (!tbody || !user) {
        return;
    }

    tbody.innerHTML = user.transactions.map(function (tx, index) {
        return (
            '<tr data-index="' + index + '">' +
                '<td>' +
                    '<input type="text" class="tx-month" value="' + tx.month + '" placeholder="DEC">' +
                    '<input type="number" class="tx-day" value="' + tx.day + '" placeholder="15">' +
                    '<input type="number" class="tx-year" value="' + tx.year + '" placeholder="2025">' +
                '</td>' +
                '<td><input type="text" class="tx-desc" value="' + tx.desc + '"></td>' +
                '<td><input type="text" class="tx-sub" value="' + tx.sub + '"></td>' +
                '<td><input type="number" class="tx-amount" step="0.01" value="' + tx.amount + '"></td>' +
                '<td>' +
                    '<select class="tx-type">' +
                        '<option value="positive"' + (tx.type === 'positive' ? ' selected' : '') + '>Credit</option>' +
                        '<option value="negative"' + (tx.type === 'negative' ? ' selected' : '') + '>Debit</option>' +
                    '</select>' +
                '</td>' +
                '<td><button type="button" class="icon-btn remove-transaction"><i class="fas fa-trash"></i></button></td>' +
            '</tr>'
        );
    }).join('');

    tbody.querySelectorAll('.remove-transaction').forEach(function (button) {
        button.addEventListener('click', function () {
            const index = Number(button.closest('tr').dataset.index);
            user.transactions.splice(index, 1);
            renderTransactions();
            updateOverview();
        });
    });
}

function updateAdminEnvUI() {
    const managedByEnv = !!(appData && appData.admin && appData.admin.managedByEnv);
    const note = document.getElementById('adminEnvNote');
    const usernameField = document.getElementById('adminUsername');
    const passwordField = document.getElementById('adminPassword');

    if (note) {
        note.hidden = !managedByEnv;
    }
    if (usernameField) {
        usernameField.readOnly = managedByEnv;
    }
    if (passwordField) {
        passwordField.readOnly = managedByEnv;
        passwordField.placeholder = managedByEnv
            ? 'Managed by environment variables'
            : 'Leave blank to keep current password';
    }
}

function populateForm() {
    if (!appData || !Array.isArray(appData.users)) {
        throw new Error('Unable to load dashboard data.');
    }

    if (appData.users.length === 0) {
        updateAdminEnvUI();
        updateUserLimitUI();
        updateLoginUrl();
        renderUsersList();
        return;
    }

    if (!selectedUserId || !appData.users.some(function (user) { return user.id === selectedUserId; })) {
        selectedUserId = appData.users[0].id;
    }

    const user = ensureUserShape(getSelectedUser());

    setFieldValue('fullName', user.fullName);
    setFieldValue('userProfileUsername', user.username || '');
    setFieldValue('userProfilePassword', user.loginPassword || '');
    syncQuickBalancesFromUser(user);
    const restriction = normalizeRestriction(user.restriction);
    setFieldValue('restrictionTitle', restriction.title);
    setFieldValue('restrictionGreeting', restriction.greeting);
    setFieldValue('restrictionMessage', restriction.message);
    setFieldValue('restrictionFeeText', restriction.feeText);
    setFieldValue('restrictionButton', restriction.button);
    setFieldValue('restrictionSupport', restriction.support);
    setFieldValue('settlementFee', restriction.settlementFee);
    updateRestrictionPreview();
    setFieldValue('investTotalValue', user.invest.totalValue);
    setFieldValue('investChangeAmount', user.invest.changeAmount);
    setFieldValue('investChangePercent', user.invest.changePercent);
    setFieldValue('adminUsername', appData.admin.username);
    setFieldValue('adminPassword', '');

    updateAdminEnvUI();
    renderUserSwitcher();
    renderUsersList();
    renderAccounts();
    renderHoldings();
    renderTransactions();
    updateOverview();
    updateUserLimitUI();
    updateLoginUrl();
}

async function loadDashboard() {
    showBootLoader(true);
    if (getToken()) {
        document.documentElement.classList.add('admin-session-pending');
        showDashboard();
    }

    try {
        const response = await apiRequest('/admin/data');
        applyServerPayload(response);
        populateForm();
        showDashboard();
        startSessionRefresh();
    } catch (error) {
        setToken(null);
        showLogin();
        showToast(window.BoASecure ? window.BoASecure.toUserMessage(error, 'load') : 'Unable to load dashboard.', true);
    } finally {
        showBootLoader(false);
        clearSessionPending();
    }
}

function setLoginLoading(isLoading) {
    const button = document.getElementById('loginSubmitBtn');
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Signing In...' : 'Sign In';
}

function isMobileSidebar() {
    return window.innerWidth <= 900;
}

function closeMobileSidebar() {
    document.body.classList.remove('sidebar-mobile-open');
}

function openMobileSidebar() {
    if (isMobileSidebar()) {
        document.body.classList.add('sidebar-mobile-open');
    }
}

function initMobileSidebar() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (menuBtn) {
        menuBtn.addEventListener('click', openMobileSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeMobileSidebar);
    }

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (button) {
        button.addEventListener('click', closeMobileSidebar);
    });

    window.addEventListener('resize', function () {
        if (!isMobileSidebar()) {
            closeMobileSidebar();
        }
    });
}

function initSidebarToggle() {
    const sidebar = document.getElementById('adminSidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (!sidebar || !toggle) {
        return;
    }

    const savedCollapsed = localStorage.getItem('boaAdminSidebarCollapsed') === 'true';
    if (!isMobileSidebar()) {
        setSidebarCollapsed(savedCollapsed);
    }

    toggle.addEventListener('click', function () {
        if (isMobileSidebar()) {
            openMobileSidebar();
            return;
        }
        const collapsed = !sidebar.classList.contains('collapsed');
        setSidebarCollapsed(collapsed);
        localStorage.setItem('boaAdminSidebarCollapsed', String(collapsed));
    });
}

function setSidebarCollapsed(collapsed) {
    const sidebar = document.getElementById('adminSidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (!sidebar || !toggle) {
        return;
    }

    sidebar.classList.toggle('collapsed', collapsed);
    toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    const icon = toggle.querySelector('i');
    if (icon) {
        icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    }
}

function initPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(function (button) {
        button.addEventListener('click', function () {
            const input = document.getElementById(button.dataset.target);
            const icon = button.querySelector('i');
            if (!input || !icon) {
                return;
            }

            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
            button.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        });
    });
}

function initAdminApp() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const error = document.getElementById('loginError');
        error.textContent = '';
        setLoginLoading(true);

        try {
            const result = await apiRequest('/admin/login', {
                method: 'POST',
                body: JSON.stringify({ username: username, password: password })
            });
            setToken(result.token);
            await loadDashboard();
        } catch (err) {
            error.textContent = window.BoASecure
                ? window.BoASecure.toUserMessage(err, 'auth')
                : 'Unable to sign in.';
        } finally {
            setLoginLoading(false);
        }
    });

    bindClick('logoutBtn', function () {
        setToken(null);
        showLogin();
    });

    bindClick('saveBtn', async function () {
        try {
            collectFormData();
            if (userLimits.maxUsers != null && appData.users.length > userLimits.maxUsers) {
                showToast(USER_LIMIT_MESSAGE, true);
                return;
            }
            const result = await apiRequest('/admin/data', {
                method: 'PUT',
                body: JSON.stringify(appData)
            });
            applyServerPayload(result.data);
            populateForm();
            showToast('All changes saved successfully.');
        } catch (err) {
            showToast(window.BoASecure ? window.BoASecure.toUserMessage(err, 'save') : 'Unable to save changes. Please try again.', true);
        }
    });

    bindClick('resetBtn', async function () {
        if (!confirm('Reset all data to default values?')) {
            return;
        }

        try {
            const result = await apiRequest('/admin/reset', { method: 'POST' });
            applyServerPayload(result.data);
            selectedUserId = null;
            populateForm();
            showToast('Defaults restored.');
        } catch (err) {
            showToast(window.BoASecure ? window.BoASecure.toUserMessage(err, 'save') : 'Unable to save changes. Please try again.', true);
        }
    });

    bindClick('createUserBtn', function () {
        if (!canCreateUser()) {
            showToast(USER_LIMIT_MESSAGE, true);
            return;
        }
        collectFormData();
        const newUser = createBlankUser();
        appData.users.push(newUser);
        selectedUserId = newUser.id;
        populateForm();
        switchSection('users');
        showToast('New user created. Set login, balances, and restriction fee, then Save.');
    });

    bindClick('deleteUserBtn', function () {
        const user = getSelectedUser();
        if (!user) {
            return;
        }
        deleteUser(user.id);
    });

    bindClick('addAccountBtn', function () {
        const user = getSelectedUser();
        if (!user) {
            showToast('Select a user first.', true);
            return;
        }
        user.accounts.push({ name: 'New Account', balance: 0 });
        renderAccounts();
        updateOverview();
        renderUsersList();
        renderUserSwitcher();
        showToast('Account added. Update the name and balance, then Save.');
    });

    bindClick('addHoldingBtn', function () {
        const user = getSelectedUser();
        if (!user) {
            showToast('Select a user first.', true);
            return;
        }
        user.invest.holdings.push({ name: 'New Holding', symbol: 'SYM', value: 0, change: 0 });
        renderHoldings();
        showToast('Holding added. Update the details, then Save.');
    });

    bindClick('addTransactionBtn', function () {
        const user = getSelectedUser();
        if (!user) {
            showToast('Select a user first.', true);
            return;
        }
        user.transactions.unshift({
            month: 'DEC',
            day: new Date().getDate(),
            year: new Date().getFullYear(),
            desc: 'New Transaction',
            sub: 'Category',
            amount: 0,
            type: 'negative'
        });
        renderTransactions();
        updateOverview();
        showToast('Transaction added. Update the details, then Save.');
    });

    bindClick('openRestrictionEditorBtn', function () {
        collectFormData();
        switchSection('messages');
        showToast('Edit the full Account Restricted popup here, then Save.');
    });

    [
        'restrictionTitle',
        'restrictionGreeting',
        'restrictionMessage',
        'restrictionFeeText',
        'restrictionButton',
        'restrictionSupport',
        'settlementFee'
    ].forEach(function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', updateRestrictionPreview);
        el.addEventListener('change', updateRestrictionPreview);
    });

    const activeUserSelect = document.getElementById('activeUserSelect');
    if (activeUserSelect) {
        activeUserSelect.addEventListener('change', function () {
            collectFormData();
            selectedUserId = activeUserSelect.value;
            populateForm();
        });
    }

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (button) {
        button.addEventListener('click', function () {
            collectFormData();
            switchSection(button.dataset.section);
        });
    });

    if (getToken()) {
        document.documentElement.classList.add('admin-session-pending');
        showDashboard();
        loadDashboard().catch(function () {
            setToken(null);
            showLogin();
        });
    } else {
        showLogin();
    }

    initPasswordToggles();
    initSidebarToggle();
    initMobileSidebar();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
    initAdminApp();
}
