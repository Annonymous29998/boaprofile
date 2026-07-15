const { test, expect } = require('@playwright/test');

test.describe('Smoke tests', function () {
    test('home page loads and shows login entry point', async function ({ page }) {
        const response = await page.goto('/index.html');
        expect(response.status()).toBe(200);
        await expect(page.getByRole('button', { name: 'LOG IN' })).toBeVisible();
        await expect(page.locator('.splash-brand')).toHaveText('BANK OF AMERICA');
    });

    test('admin login page loads', async function ({ page }) {
        const response = await page.goto('/admin');
        expect(response.status()).toBe(200);
        await expect(page.getByRole('heading', { name: 'Admin Console' })).toBeVisible();
        await expect(page.locator('#loginUsername')).toBeVisible();
        await expect(page.locator('#loginPassword')).toBeVisible();
    });

    test('public realtime config endpoint responds', async function ({ request }) {
        const response = await request.get('/api/public/realtime-config');
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body).toHaveProperty('enabled');
    });

    test('protected config endpoint requires auth', async function ({ request }) {
        const response = await request.get('/api/config');
        expect(response.status()).toBe(401);
    });

    test('dashboard redirects unauthenticated users to login', async function ({ page }) {
        await page.goto('/dashboard.html');
        await page.waitForURL('**/index.html');
        await expect(page.getByRole('button', { name: 'LOG IN' })).toBeVisible();
    });
});
