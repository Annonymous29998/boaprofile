(function () {
    const SUGGESTIONS = [
        'What is my balance?',
        'Find a recent purchase',
        'Help me pay a bill',
        'Set up alerts'
    ];

    let overlay = null;
    let ericaLog = [];

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function customerName() {
        try {
            return (BoAConfig.get().fullName || 'there').split(' ')[0];
        } catch (error) {
            return 'there';
        }
    }

    function balancesText() {
        try {
            const accounts = BoAConfig.get().accounts || [];
            if (!accounts.length) {
                return 'I can show balances from your Accounts overview once they load.';
            }
            return accounts.map(function (account) {
                return account.name + ': ' + BoAConfig.formatCurrency(account.balance);
            }).join('\n');
        } catch (error) {
            return 'Open Accounts to see your available balances.';
        }
    }

    function recentPurchaseText() {
        try {
            const txs = (BoAConfig.get().transactions || []).filter(function (tx) {
                return tx.type !== 'positive';
            });
            const tx = txs[0];
            if (!tx) {
                return 'I do not see a recent purchase yet. You can also scroll activity on an account.';
            }
            return 'A recent purchase I see is ' + tx.desc + ' for ' +
                BoAConfig.formatCurrency(Math.abs(tx.amount)) +
                ' on ' + tx.month + ' ' + tx.day + ', ' + tx.year + '.';
        } catch (error) {
            return 'I can help you find transactions from your account activity.';
        }
    }

    function answerErica(question) {
        const q = String(question || '').toLowerCase();
        if (/balance|how much|available/.test(q)) {
            return 'Here are the available balances I see:\n\n' + balancesText();
        }
        if (/transaction|purchase|spend|find/.test(q)) {
            return recentPurchaseText() + '\n\nYou can also tap VIEW on an account to see activity.';
        }
        if (/bill|pay/.test(q)) {
            return 'You can pay a bill from Pay & Transfer > Bill Pay. I can take you there from the bottom of the app.';
        }
        if (/alert|notif/.test(q)) {
            return 'Open Mailbox, then Alerts, to review security and account-activity alerts. You can manage alert settings the same way as in the Bank of America app.';
        }
        if (/transfer|zelle|wire/.test(q)) {
            return 'Pay & Transfer is where you send money with Zelle®, transfer between accounts, pay bills, or send a wire.';
        }
        if (/reward|gold|preferred/.test(q)) {
            return 'You are in Preferred Rewards Gold on this profile. Open My Rewards for Gold benefits.';
        }
        return 'I can help with balances, recent purchases, bills, alerts, and transfers — the same things you can ask Erica® in the Bank of America app. Try one of the suggestions, or type a question.';
    }

    function ensureOverlay() {
        if (overlay) {
            return overlay;
        }
        overlay = document.createElement('div');
        overlay.className = 'dash-extra-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML =
            '<div class="dash-extra-sheet">' +
                '<header class="dash-extra-header">' +
                    '<button type="button" class="dash-extra-close" id="dashExtraClose">Close</button>' +
                    '<h2 id="dashExtraTitle"></h2>' +
                    '<span class="dash-extra-spacer"></span>' +
                '</header>' +
                '<div class="dash-extra-body" id="dashExtraBody"></div>' +
            '</div>';
        const host = document.querySelector('.mobile-container') || document.body;
        host.appendChild(overlay);
        overlay.querySelector('#dashExtraClose').addEventListener('click', closeExtra);
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeExtra();
        });
        overlay.querySelector('#dashExtraBody').addEventListener('click', function (event) {
            const chip = event.target.closest('[data-erica-q]');
            if (chip) {
                askErica(chip.getAttribute('data-erica-q'));
            }
            const go = event.target.closest('[data-go]');
            if (go) {
                window.location.href = go.getAttribute('data-go');
            }
        });
        overlay.querySelector('#dashExtraBody').addEventListener('submit', function (event) {
            if (!event.target.matches('#ericaForm')) {
                return;
            }
            event.preventDefault();
            const input = overlay.querySelector('#ericaInput');
            const text = (input && input.value || '').trim();
            if (!text) {
                return;
            }
            input.value = '';
            askErica(text);
        });
        return overlay;
    }

    function setTitle(title) {
        overlay.querySelector('#dashExtraTitle').textContent = title;
    }

    function renderErica(seedQuestion) {
        setTitle('Ask Erica®');
        if (!ericaLog.length) {
            ericaLog.push({
                who: 'erica',
                text: 'Hi ' + customerName() + '. I\'m Erica, your virtual financial assistant. Tap, talk, or type to check a balance, find a transaction, pay a bill, or set up alerts.'
            });
        }
        const body = overlay.querySelector('#dashExtraBody');
        body.innerHTML =
            '<div class="erica-thread" id="ericaThread"></div>' +
            '<div class="erica-chips">' +
                SUGGESTIONS.map(function (item) {
                    return '<button type="button" class="erica-chip" data-erica-q="' + escapeHtml(item) + '">' + escapeHtml(item) + '</button>';
                }).join('') +
            '</div>' +
            '<form class="erica-form" id="ericaForm">' +
                '<input type="text" id="ericaInput" placeholder="Ask Erica" autocomplete="off">' +
                '<button type="submit">Send</button>' +
            '</form>';
        paintEricaThread();
        if (seedQuestion) {
            askErica(seedQuestion);
        }
    }

    function paintEricaThread() {
        const thread = overlay.querySelector('#ericaThread');
        if (!thread) {
            return;
        }
        thread.innerHTML = ericaLog.map(function (msg) {
            return '<div class="erica-bubble ' + msg.who + '">' + escapeHtml(msg.text).replace(/\n/g, '<br>') + '</div>';
        }).join('');
        thread.scrollTop = thread.scrollHeight;
    }

    function askErica(question) {
        ericaLog.push({ who: 'you', text: question });
        ericaLog.push({ who: 'erica', text: answerErica(question) });
        paintEricaThread();
    }

    function renderLifePlan() {
        setTitle('Life Plan®');
        overlay.querySelector('#dashExtraBody').innerHTML =
            '<p class="dash-extra-intro">Bank of America Life Plan® helps you see next steps for spending, saving, and longer-term goals — the same tool from your Accounts overview.</p>' +
            '<article class="dash-extra-card">' +
                '<h3>Review recent spending</h3>' +
                '<p>Look at activity on your accounts and ask Erica to find a purchase.</p>' +
                '<button type="button" class="dash-extra-link" data-erica-open="spend">Ask Erica</button>' +
            '</article>' +
            '<article class="dash-extra-card">' +
                '<h3>Keep an emergency cushion</h3>' +
                '<p>Advantage Savings is available from Products if you want a dedicated savings bucket for unexpected expenses.</p>' +
            '</article>' +
            '<article class="dash-extra-card">' +
                '<h3>Stay on track for Gold</h3>' +
                '<p>Preferred Rewards Gold benefits depend on qualifying Bank of America and Merrill balances. Open My Rewards for your current tier.</p>' +
            '</article>';
        overlay.querySelector('[data-erica-open="spend"]').addEventListener('click', function () {
            ericaLog = [];
            renderErica('Find a recent purchase');
        });
    }

    function renderRewards() {
        setTitle('My Rewards');
        overlay.querySelector('#dashExtraBody').innerHTML =
            '<p class="dash-extra-intro">Preferred Rewards Gold is shown on your Accounts overview, the same way Bank of America displays your relationship tier.</p>' +
            '<article class="dash-extra-card">' +
                '<h3>Preferred Rewards Gold</h3>' +
                '<p>Gold can include relationship interest rates, a credit card rewards bonus on eligible cards, and waived fees on eligible checking and savings accounts when you maintain qualifying balances.</p>' +
            '</article>' +
            '<article class="dash-extra-card">' +
                '<h3>How you keep Gold</h3>' +
                '<p>Qualifying combined balances in eligible deposit and investment accounts determine your tier. Platinum and Diamond have higher balance requirements and additional benefits.</p>' +
            '</article>' +
            '<article class="dash-extra-card">' +
                '<h3>BankAmeriDeals®</h3>' +
                '<p>Eligible cards can also earn cash back at participating merchants. Find deals under Products.</p>' +
            '</article>';
    }

    function openExtra(kind, seed) {
        ensureOverlay();
        if (kind === 'erica') {
            renderErica(seed);
        } else if (kind === 'lifeplan') {
            renderLifePlan();
        } else {
            renderRewards();
        }
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('dash-extra-open');
        const input = overlay.querySelector('#ericaInput');
        if (input) {
            input.focus();
        }
    }

    function closeExtra() {
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('dash-extra-open');
    }

    function bind() {
        const search = document.querySelector('.search-box input');
        const erica = document.querySelector('.erica-icon');
        const rows = document.querySelectorAll('.welcome-card .card-row');

        if (erica) {
            erica.setAttribute('role', 'button');
            erica.style.cursor = 'pointer';
            erica.addEventListener('click', function () {
                ericaLog = [];
                openExtra('erica');
            });
        }
        if (search) {
            search.addEventListener('focus', function () {
                if (!overlay || !overlay.classList.contains('is-open')) {
                    ericaLog = [];
                    openExtra('erica');
                }
            });
            search.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const q = search.value.trim();
                    search.value = '';
                    ericaLog = [];
                    openExtra('erica', q || '');
                }
            });
        }
        if (rows[1]) {
            rows[1].style.cursor = 'pointer';
            rows[1].addEventListener('click', function () {
                openExtra('lifeplan');
            });
        }
        if (rows[2]) {
            rows[2].style.cursor = 'pointer';
            rows[2].addEventListener('click', function () {
                openExtra('rewards');
            });
        }
        if (rows[0]) {
            rows[0].style.cursor = 'pointer';
            rows[0].addEventListener('click', function () {
                openExtra('rewards');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
