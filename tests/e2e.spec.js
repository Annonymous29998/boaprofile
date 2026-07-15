const { test, expect } = require('@playwright/test');

const CUSTOMER = {
    username: process.env.TEST_CUSTOMER_USERNAME || '',
    password: process.env.TEST_CUSTOMER_PASSWORD || '',
    fullName: process.env.TEST_CUSTOMER_NAME || 'Customer'
};

const ADMIN = {
    username: process.env.ADMIN_USERNAME || '',
    password: process.env.ADMIN_PASSWORD || ''
};

const hasCustomerCredentials = !!(CUSTOMER.username && CUSTOMER.password);
const hasAdminCredentials = !!(ADMIN.username && ADMIN.password);

async function openCustomerLogin(page) {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'LOG IN' }).click();
    await expect(page.locator('#loginScreen')).toBeVisible();
}

test.describe('Customer e2e', function () {
    test('customer can sign in and see dashboard balances', async function ({ page }) {
        test.skip(!hasCustomerCredentials, 'Set TEST_CUSTOMER_USERNAME and TEST_CUSTOMER_PASSWORD in .env');

        await openCustomerLogin(page);
        await page.locator('#username').fill(CUSTOMER.username);
        await page.locator('#password').fill(CUSTOMER.password);
        await page.locator('.sign-in-btn').click();

        await page.waitForURL('**/dashboard.html', { timeout: 15000 });
        await expect(page.locator('#userGreeting')).toContainText(CUSTOMER.fullName);
        await expect(page.locator('#accountList')).toContainText('Current Account');
        await expect(page.locator('#accountList')).toContainText('Savings Account');
    });

    test('customer sees invalid login message for bad credentials', async function ({ page }) {
        await openCustomerLogin(page);
        await page.locator('#username').fill('not-a-real-user');
        await page.locator('#password').fill('wrong-password');
        await page.locator('.sign-in-btn').click();

        await expect(page.locator('#modalMessage')).toContainText('Invalid username or password', {
            timeout: 15000
        });
    });

    test('customer can open pay and transfer page after login', async function ({ page }) {
        test.skip(!hasCustomerCredentials, 'Set TEST_CUSTOMER_USERNAME and TEST_CUSTOMER_PASSWORD in .env');

        await openCustomerLogin(page);
        await page.locator('#username').fill(CUSTOMER.username);
        await page.locator('#password').fill(CUSTOMER.password);
        await page.locator('.sign-in-btn').click();
        await page.waitForURL('**/dashboard.html', { timeout: 15000 });

        await page.locator('#pay-transfer-tab').click();
        await page.waitForURL('**/pay_transfer.html');
        await expect(page.locator('body')).toContainText('Pay & Transfer');
    });
});

test.describe('Admin e2e', function () {
    test('admin can sign in and view user overview', async function ({ page }) {
        test.skip(!hasAdminCredentials, 'Set ADMIN_USERNAME and ADMIN_PASSWORD in .env');

        await page.goto('/admin');
        await page.locator('#loginUsername').fill(ADMIN.username);
        await page.locator('#loginPassword').fill(ADMIN.password);
        await page.locator('#loginSubmitBtn').click();

        await expect(page.locator('#dashboardView')).toBeVisible({ timeout: 15000 });
        await page.locator('.nav-item[data-section="users"]').click();
        await expect(page.locator('#usersList')).toBeVisible();
        await expect(page.locator('#usersList .user-card').first()).toBeVisible();
    });

    test('admin rejects invalid credentials', async function ({ page }) {
        await page.goto('/admin');
        await page.locator('#loginUsername').fill('wrong-admin');
        await page.locator('#loginPassword').fill('wrong-password');
        await page.locator('#loginSubmitBtn').click();

        await expect(page.locator('#loginError')).toContainText('Invalid admin credentials', {
            timeout: 10000
        });
        await expect(page.locator('#dashboardView')).toBeHidden();
    });
});
