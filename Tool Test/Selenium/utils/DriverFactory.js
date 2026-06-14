const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

class DriverFactory {
    static async createDriver(browser = 'chrome') {
        let driver;
        switch (browser.toLowerCase()) {
            case 'chrome':
                const options = new chrome.Options();
                // options.addArguments('--headless'); // Uncomment for headless mode
                options.addArguments('--no-sandbox');
                options.addArguments('--disable-dev-shm-usage');
                options.addArguments('--window-size=1920,1080');
                
                driver = await new Builder()
                    .forBrowser('chrome')
                    .setChromeOptions(options)
                    .build();
                break;
            default:
                throw new Error(`Browser ${browser} is not supported`);
        }
        
        await driver.manage().setTimeouts({ implicit: 10000 });
        return driver;
    }
}

module.exports = DriverFactory;
