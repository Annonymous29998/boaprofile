const { test, expect } = require('@playwright/test');

/**
 * Regression suite: critical routes and auth gates that should not break
 * across refactors (covers smoke + core navigation contracts).
 */
test.describe('Regression tests', function () {
    const publicPages = [
        { path: '/index.html', mustSee: 'LOG IN' },
        { path: '/admin', mustSee: 'Admin Console' }
    ];

    for (const pageDef of publicPages) {
        test('loads ' + pageDef.path, async function ({ page }) {
            const response = await page.goto(pageDef.path);
            expect(response.status()).toBe(200);
            await expect(page.getByText(pageDef.mustSee).first()).toBeVisible();
        });
    }

    const protectedPages = [
        '/dashboard.html',
        '/pay_transfer.html',
        '/deposit_checks.html',
        '/invest.html'
    ];

    for (const path of protectedPages) {
        test('unauthenticated access to ' + path + ' redirects to login', async function ({ page }) {
            await page.goto(path);
            await page.waitForURL('**/index.html');
            await expect(page.getByRole('button', { name: 'LOG IN' })).toBeVisible();
        });
    }

    test('login API rejects empty credentials', async function ({ request }) {
        const response = await request.post('/api/login', {
            data: { username: '', password: '' }
        });
        expect([400, 401]).toContain(response.status());
    });

    test('admin login API rejects bad credentials', async function ({ request }) {
        const response = await request.post('/api/admin/login', {
            data: { username: 'bad-admin', password: 'bad-password' }
        });
        expect(response.status()).toBe(401);
    });

    test('customer JWT config endpoint stays protected', async function ({ request }) {
        const response = await request.get('/api/config');
        expect(response.status()).toBe(401);
    });
});
