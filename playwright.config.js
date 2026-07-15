const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

const productionBaseUrl = process.env.BASE_URL;
const localBaseUrl = 'http://localhost:3001';

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: productionBaseUrl ? 1 : undefined,
    reporter: [['list']],
    use: {
        baseURL: productionBaseUrl || localBaseUrl,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: productionBaseUrl ? undefined : {
        command: 'PORT=3001 npm start',
        url: localBaseUrl,
        reuseExistingServer: false,
        timeout: 120000
    }
});
