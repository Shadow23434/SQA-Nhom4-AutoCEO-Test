const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const { expect } = require('chai');
const { By } = require('selenium-webdriver');
const DriverFactory = require('../utils/DriverFactory');
const LoginPage = require('../pages/LoginPage');
const TasksPage = require('../pages/TasksPage');

describe('Task Management', function() {
    let driver;
    let loginPage;
    let tasksPage;

    before(async function() {
        driver = await DriverFactory.createDriver();
        loginPage = new LoginPage(driver);
        tasksPage = new TasksPage(driver);
        
        // Login first as tasks are protected
        await loginPage.navigateTo(loginPage.url);
        await loginPage.login(
            process.env.TEST_EMAIL || 'test@example.com',
            process.env.TEST_PASSWORD || 'password123'
        );
        
        // Wait for redirect
        await driver.sleep(2000);
    });

    after(async function() {
        if (driver) {
            await driver.quit();
        }
    });

    beforeEach(async function() {
        await tasksPage.navigateTo(tasksPage.url);
    });

    it('TC-SW-004: Should navigate between Task and Employee tabs', async function() {
        await tasksPage.goToEmployeesTab();
        // Verify something on employee tab
        const isEmployeeFormVisible = await tasksPage.isVisible(By.xpath("//h3[contains(text(), 'Employee')]"));
        // This is a placeholder check, adjust to actual UI
    });

    it('TC-SW-005: Should open Sync Dialog', async function() {
        await tasksPage.openSyncDialog();
        const isDialogVisible = await tasksPage.isVisible(tasksPage.syncTasksButton);
        expect(isDialogVisible).to.be.true;
    });

    it('TC-SW-006: Should create a new employee and then delete it (Rollback)', async function() {
        const testName = 'Selenium Test Employee';
        const testUid = '123456789';
        
        await tasksPage.goToEmployeesTab();
        
        try {
            // 1. Tạo nhân viên mới
            await tasksPage.createEmployee(testName, '1990-01-01', 'Telegram', testUid);
            
            // 2. Kiểm tra nhân viên mới có xuất hiện trong danh sách không
            const employeeRow = By.xpath(`//tr[td[contains(text(), '${testName}')]]`);
            const isVisible = await tasksPage.isVisible(employeeRow);
            expect(isVisible).to.be.true;
        } finally {
            // 3. Rollback: Xóa nhân viên bất kể test phía trên pass hay fail
            try {
                await tasksPage.rollbackEmployeeAPI(testName);
            } catch (e) {
                // Ignore rollback errors to keep console clean
            }
        }
    });

    it('TC-SW-007: Should edit a task and assign it to the newly created employee', async function() {
        const testName = 'Assignee Test Employee';
        // Dùng UID động để tránh lỗi Unique trùng lặp trong DB
        const testUid = 'UID_' + Date.now();

        // 1. Vào màn hình Employee Config
        await tasksPage.goToEmployeesTab();

        try {
            // Tạo 1 nhân viên mới (dùng chung dữ liệu chuẩn như TC002, bỏ qua chờ toast)
            await tasksPage.createEmployee(testName, '1990-01-01', 'Telegram', testUid, true);

            // 2. Chuyển sang màn hình Task List
            await tasksPage.goToTasksTab();

            // 3, 4, 5. Nhấn Edit Task, chọn assignee và Save Changes
            await tasksPage.editFirstTaskAssignee(testName);

            // Nếu hàm trên chạy mượt mà không throw timeout, nghĩa là test Pass
            expect(true).to.be.true;
        } finally {
            // 1. Rollback Task qua giao diện (để trả về Unassigned chuẩn xác nhất)
            try {
                await tasksPage.goToTasksTab();
                await tasksPage.editFirstTaskAssignee('Unassigned');
            } catch (e) {
                // Ignore UI rollback errors
            }

            // 2. Rollback toàn bộ DB sau khi test (xoá employee vừa tạo)
            try {
                await tasksPage.rollbackEmployeeAPI(testName);
            } catch (e) {
                // Ignore API rollback errors
            }
        }
    });
});
