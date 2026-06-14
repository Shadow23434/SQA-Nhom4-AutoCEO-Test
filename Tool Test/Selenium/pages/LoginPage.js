const { By, until } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class LoginPage extends BasePage {
    constructor(driver) {
        super(driver);
        this.url = `${process.env.BASE_URL || 'http://localhost:5173'}/login`;

        // Locators based on Login.tsx
        this.emailInput = By.id('gmail');
        this.passwordInput = By.id('password');
        this.loginButton = By.css('button[type="submit"]');
        this.welcomeText = By.xpath("//h1[contains(text(),'Welcome')]");
    }

    async login(email, password) {
        await this.type(this.emailInput, email);
        await this.type(this.passwordInput, password);
        await this.click(this.loginButton);
    }

    async waitForLoginSuccess() {
        // Đợi URL chuyển sang /dashboard (tối đa 10s)
        await this.driver.wait(async () => {
            const url = await this.driver.getCurrentUrl();
            return url.includes('/dashboard');
        }, 10000, 'Không chuyển hướng sang dashboard sau khi login');
    }

    async getErrorMessage() {
        const toastXpath = By.xpath("(//div|//span|//p)[contains(text(), 'không tồn tại') or contains(text(), 'Sai') or contains(text(), 'Vui lòng')]");
        try {
            const element = await this.driver.wait(until.elementLocated(toastXpath), 10000);
            // Dùng textContent thay vì getText() để bỏ qua kiểm tra visibility của Selenium
            const text = await element.getAttribute('textContent');
            return text;
        } catch (e) {
            throw new Error('Selenium không tìm thấy thông báo lỗi nào trên màn hình.');
        }
    }
}

module.exports = LoginPage;
