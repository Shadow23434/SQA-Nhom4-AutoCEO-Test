const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const { expect } = require('chai');
const DriverFactory = require('../utils/DriverFactory');
const LoginPage = require('../pages/LoginPage');

describe('Login Functionality', function () {
    let driver;
    let loginPage;

    before(async function () {
        driver = await DriverFactory.createDriver();
        loginPage = new LoginPage(driver);
    });

    after(async function () {
        if (driver) {
            await driver.quit();
        }
    });

    beforeEach(async function () {
        await loginPage.navigateTo(loginPage.url);
    });

    afterEach(async function () {
        await driver.manage().deleteAllCookies();
        await driver.executeScript('window.localStorage.clear();');
        await driver.executeScript('window.sessionStorage.clear();');
    });

    it('TC-SW-001: Should login successfully with valid credentials', async function () {
        // Note: These should be in .env or test data
        const testEmail = process.env.TEST_EMAIL;
        const testPassword = process.env.TEST_PASSWORD;

        await loginPage.login(testEmail, testPassword);

        // Đợi chuyển hướng (tối đa 10 giây)
        await loginPage.waitForLoginSuccess();

        // Verify redirection to dashboard (url change or specific element)
        const currentUrl = await driver.getCurrentUrl();
        expect(currentUrl).to.include('/dashboard');
    });

    it('TC-SW-002: Should show error with invalid password', async function () {
        await loginPage.login('test@example.com', 'wrongpassword');

        const errorMessage = await loginPage.getErrorMessage();
        expect(errorMessage).to.match(/Vui lòng điền đầy đủ thông tin|Invalid credentials|không tồn tại/);
    });

    it('TC-SW-003: Should redirect to login when accessing protected route without session', async function () {
        // 1. Truy cập trực tiếp trang Tasks khi chưa có session
        await driver.get(`${process.env.BASE_URL}/tasks`);
        
        // 2. Kiểm tra xem có bị đẩy về trang Login không
        const currentUrl = await driver.getCurrentUrl();
        expect(currentUrl).to.include('/login');

        // 3. Đăng nhập
        const testEmail = process.env.TEST_EMAIL;
        const testPassword = process.env.TEST_PASSWORD;
        await loginPage.login(testEmail, testPassword);
        await loginPage.waitForLoginSuccess();
        
        // 4. Đăng nhập xong mặc định sẽ vào Dashboard
        const finalUrl = await driver.getCurrentUrl();
        expect(finalUrl).to.include('/tasks');
    });
});
