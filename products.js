(function () {
    const PRODUCTS = [
        {
            id: 'checking',
            icon: 'fa-university',
            title: 'Checking',
            subtitle: 'Bank of America Advantage Banking',
            body:
                'Advantage Banking is built for everyday banking: debit card, Mobile Check Deposit, Zelle®, Bill Pay, and transfers in the app.\n\n' +
                'You can keep using the accounts you already have. To open another checking solution, including Student or Business checking, start in Products or visit a financial center.'
        },
        {
            id: 'savings',
            icon: 'fa-piggy-bank',
            title: 'Savings, CDs & IRAs',
            subtitle: 'Advantage Savings and other deposit products',
            body:
                'Bank of America Advantage Savings, CDs, and IRAs are listed under Products so you can compare deposit options in one place.\n\n' +
                'Savings and CDs you already hold appear on your Accounts overview. New accounts can be opened in Mobile or Online Banking, or at a financial center.'
        },
        {
            id: 'cards',
            icon: 'fa-credit-card',
            title: 'Credit cards',
            subtitle: 'Cash back, travel, student, and lower-rate cards',
            body:
                'Shop Bank of America credit cards the same way the app does: cash back, travel and airline rewards, student cards, cards to build credit, and lower interest rate cards.\n\n' +
                'If you already have a card, manage it from Accounts. New applications are started from Products in the Mobile app or from Shop all credit cards in Online Banking.'
        },
        {
            id: 'home',
            icon: 'fa-home',
            title: 'Home loans',
            subtitle: 'Mortgage, refinance, and home equity',
            body:
                'Explore a mortgage to buy a home, refinance an existing loan, or tap home equity.\n\n' +
                'Bank of America Home Loans specialists can help you compare options. You can also schedule an appointment from Products or Online Banking.'
        },
        {
            id: 'auto',
            icon: 'fa-car',
            title: 'Auto loans',
            subtitle: 'Finance or refinance a vehicle',
            body:
                'Check auto loan and refinance options from Products. Pre-qualification and applications are completed through Bank of America Auto Loans, then the loan appears with your other accounts if approved.'
        },
        {
            id: 'invest',
            icon: 'fa-chart-line',
            title: 'Investing with Merrill',
            subtitle: 'Banking and investing in one app',
            body:
                'Merrill accounts show on your Accounts overview in the unified Bank of America app: self-directed investing, advised relationships, and retirement.\n\n' +
                'Use Invest in the app to view holdings, or open a Merrill account from Products.'
        },
        {
            id: 'deals',
            icon: 'fa-tags',
            title: 'Deals',
            subtitle: 'BankAmeriDeals® cash back',
            body:
                'Eligible debit and credit cards can earn cash back at participating merchants through BankAmeriDeals®.\n\n' +
                'Add deals in Products, then shop with an eligible Bank of America or Merrill card. Cash back posts to the account used for the purchase. A data connection is required.'
        },
        {
            id: 'rewards',
            icon: 'fa-award',
            title: 'Preferred Rewards',
            subtitle: 'Benefits based on your balances',
            body:
                'Preferred Rewards Gold, Platinum, and Diamond tiers can include relationship rates, credit card rewards bonuses, and waived fees on eligible accounts.\n\n' +
                'Your current tier is shown on the Accounts overview. Keep qualifying balances in eligible Bank of America and Merrill accounts to maintain benefits.'
        }
    ];

    let overlay = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function findProduct(id) {
        return PRODUCTS.find(function (item) {
            return item.id === id;
        });
    }

    function ensureOverlay() {
        if (overlay) {
            return overlay;
        }
        overlay = document.createElement('div');
        overlay.id = 'boaProductsOverlay';
        overlay.className = 'products-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML =
            '<div class="products-sheet" role="dialog" aria-labelledby="productsTitle">' +
                '<header class="products-header">' +
                    '<button type="button" class="products-close" id="productsCloseBtn">Close</button>' +
                    '<h2 id="productsTitle">Products</h2>' +
                    '<span class="products-header-spacer"></span>' +
                '</header>' +
                '<div class="products-body" id="productsBody"></div>' +
            '</div>';
        const host = document.querySelector('.mobile-container') || document.body;
        host.appendChild(overlay);

        overlay.querySelector('#productsCloseBtn').addEventListener('click', closeProducts);
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) {
                closeProducts();
            }
        });
        overlay.querySelector('#productsBody').addEventListener('click', function (event) {
            if (event.target.closest('[data-products-back]')) {
                renderList();
                return;
            }
            const row = event.target.closest('[data-product-id]');
            if (row) {
                renderDetail(row.getAttribute('data-product-id'));
            }
        });
        return overlay;
    }

    function renderList() {
        overlay.querySelector('#productsTitle').textContent = 'Products';
        overlay.querySelector('#productsBody').innerHTML =
            '<p class="products-intro">Explore Bank of America products the same way the Mobile app does — checking, cards, lending, Merrill, and deals — without leaving Accounts.</p>' +
            PRODUCTS.map(function (item) {
                return (
                    '<button type="button" class="products-row" data-product-id="' + escapeHtml(item.id) + '">' +
                        '<span class="products-icon"><i class="fas ' + item.icon + '"></i></span>' +
                        '<span class="products-row-text">' +
                            '<strong>' + escapeHtml(item.title) + '</strong>' +
                            '<span>' + escapeHtml(item.subtitle) + '</span>' +
                        '</span>' +
                        '<i class="fas fa-chevron-right products-chevron"></i>' +
                    '</button>'
                );
            }).join('');
    }

    function renderDetail(id) {
        const item = findProduct(id);
        if (!item) {
            renderList();
            return;
        }
        overlay.querySelector('#productsTitle').textContent = item.title;
        overlay.querySelector('#productsBody').innerHTML =
            '<button type="button" class="products-back" data-products-back="true"><i class="fas fa-chevron-left"></i> Products</button>' +
            '<article class="products-detail">' +
                '<span class="products-icon large"><i class="fas ' + item.icon + '"></i></span>' +
                '<h3>' + escapeHtml(item.title) + '</h3>' +
                '<p class="products-kicker">' + escapeHtml(item.subtitle) + '</p>' +
                '<p class="products-copy">' + escapeHtml(item.body).replace(/\n/g, '<br>') + '</p>' +
            '</article>';
    }

    function openProducts() {
        ensureOverlay();
        renderList();
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('products-open');
    }

    function closeProducts() {
        if (!overlay) {
            return;
        }
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('products-open');
    }

    function bindTriggers() {
        document.querySelectorAll('.nav-right .nav-item').forEach(function (item) {
            const label = (item.querySelector('.nav-text') || {}).textContent || '';
            if (!/products/i.test(label) && !item.querySelector('.fa-shopping-cart')) {
                return;
            }
            item.setAttribute('role', 'button');
            item.addEventListener('click', function (event) {
                event.preventDefault();
                openProducts();
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindTriggers);
    } else {
        bindTriggers();
    }
})();
