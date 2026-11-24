(function () {
    let overlay = null;

    function customerName() {
        try {
            return BoAConfig.get().fullName || 'Customer';
        } catch (error) {
            return 'Customer';
        }
    }

    function ensureOverlay() {
        if (overlay) {
            return overlay;
        }
        overlay = document.createElement('div');
        overlay.className = 'boa-menu-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML =
            '<div class="boa-menu-drawer" role="dialog" aria-label="Menu">' +
                '<header class="boa-menu-header">' +
                    '<div>' +
                        '<p class="boa-menu-kicker">Bank of America</p>' +
                        '<h2 id="boaMenuName">Menu</h2>' +
                    '</div>' +
                    '<button type="button" class="boa-menu-close" id="boaMenuClose">Close</button>' +
                '</header>' +
                '<nav class="boa-menu-list">' +
                    '<button type="button" class="boa-menu-link" data-menu-go="dashboard.html"><i class="fas fa-university"></i> Accounts</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-go="pay_transfer.html"><i class="fas fa-exchange-alt"></i> Pay &amp; Transfer</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-go="deposit_checks.html"><i class="fas fa-camera"></i> Deposit checks</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-go="invest.html"><i class="fas fa-chart-line"></i> Investing</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-action="inbox"><i class="far fa-envelope"></i> Mailbox &amp; alerts</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-action="products"><i class="fas fa-shopping-cart"></i> Products</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-action="erica"><i class="fas fa-comment-dots"></i> Ask Erica®</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-action="lifeplan"><i class="fas fa-compass"></i> Life Plan®</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-action="rewards"><i class="fas fa-award"></i> Preferred Rewards</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-action="security"><i class="fas fa-shield-alt"></i> Security center</button>' +
                    '<button type="button" class="boa-menu-link" data-menu-action="help"><i class="fas fa-map-marker-alt"></i> Help &amp; locations</button>' +
                    '<button type="button" class="boa-menu-link danger" data-menu-action="logout"><i class="fas fa-sign-out-alt"></i> Sign out</button>' +
                '</nav>' +
                '<div class="boa-menu-panel" id="boaMenuPanel" hidden></div>' +
            '</div>';
        const host = document.querySelector('.mobile-container') || document.body;
        host.appendChild(overlay);

        overlay.querySelector('#boaMenuClose').addEventListener('click', closeMenu);
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeMenu();
        });
        overlay.querySelector('.boa-menu-list').addEventListener('click', onMenuClick);
        overlay.querySelector('#boaMenuPanel').addEventListener('click', function (event) {
            if (event.target.closest('[data-menu-back]')) {
                showList();
            }
        });
        return overlay;
    }

    function showList() {
        overlay.querySelector('.boa-menu-list').hidden = false;
        overlay.querySelector('#boaMenuPanel').hidden = true;
        overlay.querySelector('#boaMenuName').textContent = customerName();
    }

    function showPanel(title, html) {
        overlay.querySelector('.boa-menu-list').hidden = true;
        const panel = overlay.querySelector('#boaMenuPanel');
        panel.hidden = false;
        overlay.querySelector('#boaMenuName').textContent = title;
        panel.innerHTML =
            '<button type="button" class="boa-menu-back" data-menu-back="true"><i class="fas fa-chevron-left"></i> Menu</button>' +
            html;
    }

    function clickNav(label) {
        const items = document.querySelectorAll('.nav-right .nav-item');
        for (let i = 0; i < items.length; i += 1) {
            const text = (items[i].querySelector('.nav-text') || {}).textContent || '';
            if (text.toLowerCase().indexOf(label) !== -1) {
                items[i].click();
                return true;
            }
        }
        return false;
    }

    function onMenuClick(event) {
        const btn = event.target.closest('.boa-menu-link');
        if (!btn) return;
        const go = btn.getAttribute('data-menu-go');
        const action = btn.getAttribute('data-menu-action');
        if (go) {
            window.location.href = go;
            return;
        }
        if (action === 'inbox') {
            closeMenu();
            clickNav('inbox');
            return;
        }
        if (action === 'products') {
            closeMenu();
            clickNav('products');
            return;
        }
        if (action === 'erica') {
            closeMenu();
            const erica = document.querySelector('.erica-icon');
            if (erica) {
                erica.click();
            } else {
                window.location.href = 'dashboard.html';
            }
            return;
        }
        if (action === 'lifeplan' || action === 'rewards') {
            closeMenu();
            if (window.location.pathname.indexOf('dashboard') === -1) {
                window.location.href = 'dashboard.html';
                return;
            }
            const rows = document.querySelectorAll('.welcome-card .card-row');
            const row = action === 'lifeplan' ? rows[1] : rows[2];
            if (row) row.click();
            return;
        }
        if (action === 'security') {
            showPanel('Security center',
                '<div class="boa-menu-card">' +
                    '<p>Bank of America will never call, text, or email to ask for your PIN, password, or a one-time passcode, or to tell you to wire money to resolve fraud.</p>' +
                    '<p>If you did not sign in, call the number on the back of your debit or credit card. With the Mobile Banking Security Guarantee, you are not liable for fraudulent transactions reported promptly.</p>' +
                '</div>');
            return;
        }
        if (action === 'help') {
            showPanel('Help & locations',
                '<div class="boa-menu-card">' +
                    '<p>Find a financial center or ATM, schedule an appointment, or ask Erica® from your Accounts overview.</p>' +
                    '<p>For card issues, use the phone number on the back of your card. Mailbox holds statements, letters, and alerts.</p>' +
                '</div>');
            return;
        }
        if (action === 'logout') {
            if (window.BoAAuth) {
                BoAAuth.logout();
            }
            window.location.href = 'index.html';
        }
    }

    function openMenu() {
        ensureOverlay();
        showList();
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('boa-menu-open');
    }

    function closeMenu() {
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('boa-menu-open');
    }

    function bind() {
        document.querySelectorAll('.nav-left .nav-item').forEach(function (item) {
            const label = (item.querySelector('.nav-text') || {}).textContent || '';
            if (!/menu/i.test(label) && !item.querySelector('.fa-bars')) {
                return;
            }
            item.setAttribute('role', 'button');
            item.addEventListener('click', function (event) {
                event.preventDefault();
                openMenu();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
