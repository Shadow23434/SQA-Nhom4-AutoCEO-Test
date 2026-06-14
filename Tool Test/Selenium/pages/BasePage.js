const { until, By } = require('selenium-webdriver');

class BasePage {
    constructor(driver) {
        this.driver = driver;
        this.timeout = 15000;
    }

    async navigateTo(url) {
        await this.driver.get(url);
    }

    async find(locator) {
        return await this.driver.wait(until.elementLocated(locator), this.timeout);
    }

    async click(locator) {
        const element = await this.find(locator);
        await this.driver.wait(until.elementIsVisible(element), this.timeout);
        await element.click();
    }

    async type(locator, text) {
        const element = await this.find(locator);
        await this.driver.wait(until.elementIsVisible(element), this.timeout);
        await element.clear();
        await element.sendKeys(text);
    }

    async getText(locator) {
        const element = await this.find(locator);
        return await element.getText();
    }

    async isVisible(locator) {
        try {
            const element = await this.find(locator);
            return await element.isDisplayed();
        } catch (e) {
            return false;
        }
    }
}

module.exports = BasePage;
