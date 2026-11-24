(function () {
    const MESSAGE_ITEMS = [
        {
            id: 'stmt-nov',
            kind: 'messages',
            tag: 'Statements & Documents',
            title: 'Your statement is ready',
            date: 'Nov 18, 2026',
            preview: 'Your November statement is available to view, download, or print.',
            body:
                'Your Bank of America monthly statement is ready in Statements & Documents.\n\n' +
                'You can view, download, or print it in Mobile and Online Banking. If you are enrolled in paperless delivery, we will not mail a paper copy.\n\n' +
                'Statements are typically available around your usual statement date each month.'
        },
        {
            id: 'docs-notice',
            kind: 'messages',
            tag: 'Notifications and letters',
            title: 'A new document is available',
            date: 'Nov 12, 2026',
            preview: 'An account notice was added to Notifications and letters.',
            body:
                'A new letter is available in Statements & Documents under Notifications and letters.\n\n' +
                'Bank of America uses this inbox for official notices, including account documents and service updates. We will also email the address on your profile when a new document is ready.'
        },
        {
            id: 'paperless',
            kind: 'messages',
            tag: 'Account services',
            title: 'You are enrolled in paperless statements',
            date: 'Oct 29, 2026',
            preview: 'We will email you when a new statement is ready instead of mailing paper.',
            body:
                'Your accounts are set to paperless delivery. You will receive an email when a statement or document is ready to view in the app.\n\n' +
                'You can change paperless settings in Account Management, or ask Erica® to change paperless settings.'
        },
        {
            id: 'erica',
            kind: 'messages',
            tag: 'Ask Erica®',
            title: 'Erica has insights for you',
            date: 'Nov 8, 2026',
            preview: 'Review spending and upcoming bills from your Accounts overview.',
            body:
                'Erica® noticed activity you may want to review, including recent purchases and recurring payments.\n\n' +
                'From your Accounts overview you can tap, talk, or type to Erica to check a balance, find a transaction, or set up alerts.'
        }
    ];

    const ALERT_ITEMS = [
        {
            id: 'deposit',
            kind: 'alerts',
            tag: 'Account activity',
            title: 'Direct deposit credited',
            date: 'Nov 15, 2026',
            preview: 'A direct deposit was credited to your account.',
            body:
                'A direct deposit was credited to your Bank of America account.\n\n' +
                'You can turn this alert on or off in the mailbox: Alerts > Manage alert settings > Account activity > Direct deposit credited to your account.'
        },
        {
            id: 'signin',
            kind: 'alerts',
            tag: 'Security',
            title: 'New sign-in to your account',
            date: 'Nov 24, 2026',
            preview: 'We noticed a sign-in to Online or Mobile Banking.',
            body:
                'A sign-in to your Bank of America Online or Mobile Banking profile was completed.\n\n' +
                'If this was you, no action is needed. If you did not sign in, call us using the number on the back of your debit or credit card.\n\n' +
                'Bank of America will never ask you to wire money, share a one-time passcode, or send a payment to resolve fraud.'
        },
        {
            id: 'card',
            kind: 'alerts',
            tag: 'Card charges',
            title: 'Debit card purchase',
            date: 'Nov 20, 2026',
            preview: 'A purchase was made with your debit card.',
            body:
                'A debit card purchase posted to your account. Card charge alerts help you track spending as it happens.\n\n' +
                'Manage amount thresholds and delivery (app notification, email, or text) in Alerts.'
        },
        {
            id: 'unusual',
            kind: 'alerts',
            tag: 'Security',
            title: 'Help protect against fraud',
            date: 'Nov 3, 2026',
            preview: 'Security alerts are on for unusual activity and profile changes.',
            body:
                'Bank of America sends automatic security alerts for unusual account activity and certain profile changes, such as a change of address.\n\n' +
                'Keep your email and mobile number up to date so we can reach you quickly. We will never contact you to ask for your PIN or password.'
        }
    ];

    let activeTab = 'messages';
    let overlay = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function itemsForTab() {
        return activeTab === 'alerts' ? ALERT_ITEMS : MESSAGE_ITEMS;
    }

    function findItem(id) {
        return MESSAGE_ITEMS.concat(ALERT_ITEMS).find(function (item) {
            return item.id === id;
        });
    }

    function ensureOverlay() {
        if (overlay) {
            return overlay;
        }
        overlay = document.createElement('div');
        overlay.id = 'boaInboxOverlay';
        overlay.className = 'inbox-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML =
            '<div class="inbox-sheet" role="dialog" aria-labelledby="inboxTitle">' +
                '<header class="inbox-header">' +
                    '<button type="button" class="inbox-close" id="inboxCloseBtn">Close</button>' +
                    '<h2 id="inboxTitle">Mailbox</h2>' +
                    '<span class="inbox-header-spacer"></span>' +
                '</header>' +
                '<div class="inbox-tabs">' +
                    '<button type="button" class="inbox-tab is-active" data-inbox-tab="messages">Messages</button>' +
                    '<button type="button" class="inbox-tab" data-inbox-tab="alerts">Alerts</button>' +
                '</div>' +
                '<div class="inbox-body" id="inboxBody"></div>' +
            '</div>';
        const host = document.querySelector('.mobile-container') || document.body;
        host.appendChild(overlay);

        overlay.querySelector('#inboxCloseBtn').addEventListener('click', closeInbox);
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) {
                closeInbox();
            }
        });
        overlay.querySelectorAll('[data-inbox-tab]').forEach(function (tab) {
            tab.addEventListener('click', function () {
                activeTab = tab.getAttribute('data-inbox-tab');
                overlay.querySelectorAll('[data-inbox-tab]').forEach(function (el) {
                    el.classList.toggle('is-active', el === tab);
                });
                renderList();
            });
        });
        overlay.querySelector('#inboxBody').addEventListener('click', function (event) {
            const row = event.target.closest('[data-inbox-id]');
            if (!row) {
                return;
            }
            renderDetail(row.getAttribute('data-inbox-id'));
        });
        overlay.querySelector('#inboxBody').addEventListener('click', function (event) {
            if (event.target.closest('[data-inbox-back]')) {
                renderList();
            }
        });
        return overlay;
    }

    function renderList() {
        const body = overlay.querySelector('#inboxBody');
        const items = itemsForTab();
        const intro = activeTab === 'alerts'
            ? 'Stay in control with account activity and security alerts, the same types Bank of America sends in the app.'
            : 'Official Bank of America messages, statements, and letters — the same mailbox at the top of your account overview.';
        body.innerHTML =
            '<p class="inbox-intro">' + intro + '</p>' +
            items.map(function (item) {
                return (
                    '<button type="button" class="inbox-row" data-inbox-id="' + escapeHtml(item.id) + '">' +
                        '<div class="inbox-row-top">' +
                            '<span class="inbox-tag">' + escapeHtml(item.tag) + '</span>' +
                            '<span class="inbox-date">' + escapeHtml(item.date) + '</span>' +
                        '</div>' +
                        '<strong>' + escapeHtml(item.title) + '</strong>' +
                        '<span class="inbox-preview">' + escapeHtml(item.preview) + '</span>' +
                    '</button>'
                );
            }).join('');
    }

    function renderDetail(id) {
        const item = findItem(id);
        if (!item) {
            renderList();
            return;
        }
        overlay.querySelector('#inboxBody').innerHTML =
            '<button type="button" class="inbox-back" data-inbox-back="true"><i class="fas fa-chevron-left"></i> Back</button>' +
            '<article class="inbox-detail">' +
                '<span class="inbox-tag">' + escapeHtml(item.tag) + '</span>' +
                '<h3>' + escapeHtml(item.title) + '</h3>' +
                '<p class="inbox-date">' + escapeHtml(item.date) + '</p>' +
                '<p class="inbox-copy">' + escapeHtml(item.body).replace(/\n/g, '<br>') + '</p>' +
            '</article>';
    }

    function openInbox() {
        ensureOverlay();
        activeTab = 'messages';
        overlay.querySelectorAll('[data-inbox-tab]').forEach(function (el) {
            el.classList.toggle('is-active', el.getAttribute('data-inbox-tab') === 'messages');
        });
        renderList();
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('inbox-open');
    }

    function closeInbox() {
        if (!overlay) {
            return;
        }
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('inbox-open');
    }

    function bindTriggers() {
        document.querySelectorAll('.nav-right .nav-item').forEach(function (item) {
            const label = (item.querySelector('.nav-text') || {}).textContent || '';
            if (!/inbox/i.test(label) && !item.querySelector('.fa-envelope')) {
                return;
            }
            item.setAttribute('role', 'button');
            item.addEventListener('click', function (event) {
                event.preventDefault();
                openInbox();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindTriggers);
    } else {
        bindTriggers();
    }
})();
