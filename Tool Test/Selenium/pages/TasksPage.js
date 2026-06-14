const { By, until, Key } = require('selenium-webdriver');
const BasePage = require('./BasePage');

class TasksPage extends BasePage {
    constructor(driver) {
        super(driver);
        this.url = `${process.env.BASE_URL || 'http://localhost:5173'}/tasks`;

        // Locators based on Tasks.tsx and related components
        // Locators based on Tasks.tsx (Shadcn Tabs)
        this.taskTab = By.xpath("//button[@data-value='tasks' or contains(., 'Task List')]");
        this.employeeTab = By.xpath("//button[@data-value='employees' or contains(., 'Employee Config')]");
        this.connectPlatformButton = By.xpath("//button[contains(., 'Connect Platform')]");

        // Dialog locators (PlatformConnectDialog.tsx)
        this.syncTasksButton = By.xpath("//button[contains(., 'Đồng bộ Tasks')]");
        this.closeDialogButton = By.xpath("//button[contains(., 'Hủy')]");

        // Employee form locators
        this.employeeNameInput = By.id('emp-name');
        this.employeeDobInput = By.id('emp-dob');
        this.employeePlatformSelect = By.id('platform');
        this.employeeUidInput = By.id('uid');
        this.saveEmployeeButton = By.xpath("//button[contains(., 'Save Employee')]");

        // Task list
        this.taskListContainer = By.className('task-list-container'); // Assuming from TaskList component
    }

    async goToTasksTab() {
        await this.click(this.taskTab);
    }

    async goToEmployeesTab() {
        await this.click(this.employeeTab);
        await this.driver.sleep(1000);
    }

    async openSyncDialog() {
        await this.click(this.connectPlatformButton);
    }

    async triggerSync() {
        await this.click(this.syncTasksButton);
    }

    async createEmployee(name, dob, platform, uid, skipToastCheck = false) {
        await this.type(this.employeeNameInput, name);
        if (dob) await this.type(this.employeeDobInput, dob);

        await this.click(this.employeePlatformSelect);
        const platformItem = By.xpath(`//div[@role='option' or @role='menuitem'][contains(., '${platform}')] | //*[contains(@class, 'SelectItem')][contains(., '${platform}')]`);
        const item = await this.driver.wait(until.elementLocated(platformItem), 5000);
        await this.driver.executeScript("arguments[0].click();", item);

        await this.type(this.employeeUidInput, uid);

        // Click nút Save bằng Actions API (di chuyển chuột đến và bấm)
        const saveBtn = await this.driver.wait(until.elementLocated(this.saveEmployeeButton), 5000);
        await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", saveBtn);
        await this.driver.sleep(1000);

        await this.driver.actions({ async: true })
            .move({ origin: saveBtn })
            .press()
            .release()
            .perform();

        if (!skipToastCheck) {
            // Đợi toast thành công
            const toastXpath = "//*[(@data-sonner-toast or contains(@class, 'toast') or @role='status') and (contains(., 'thành công') or contains(., 'success'))]";
            await this.driver.wait(until.elementLocated(By.xpath(toastXpath)), 10000);
        } else {
            // Đợi một khoảng thời gian ngắn để đảm bảo API tạo employee đã được gọi thành công
            await this.driver.sleep(2000);
        }
    }

    async editFirstTaskAssignee(assigneeName) {
        // 1. Đợi table hiện ra và có ít nhất 1 dòng. Lấy nút Edit ở cột cuối của dòng đầu tiên
        // Thay vì dùng sleep 2s và findElements (có thể bị miss nếu load chậm), ta dùng wait
        const firstEditBtnXpath = "//table//tbody//tr[1]//td[last()]/button";
        let editBtn;
        try {
            editBtn = await this.driver.wait(until.elementLocated(By.xpath(firstEditBtnXpath)), 15000);
        } catch (e) {
            throw new Error("Không thể tìm thấy task nào để edit (có thể do danh sách trống hoặc load quá chậm).");
        }

        await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", editBtn);
        await this.driver.sleep(500);
        await this.driver.executeScript("arguments[0].click();", editBtn);

        // 2. Chọn Assignee
        const assigneeSelect = await this.driver.wait(until.elementLocated(By.id("edit-assignee")), 5000);
        await assigneeSelect.click();

        // Đợi một chút cho dropdown animation hoàn tất
        await this.driver.sleep(500);

        const optionXpath = `//div[@role='option' or @role='menuitem'][contains(., '${assigneeName}')] | //*[contains(@class, 'SelectItem')][contains(., '${assigneeName}')]`;
        const option = await this.driver.wait(until.elementLocated(By.xpath(optionXpath)), 5000);
        await this.driver.executeScript("arguments[0].click();", option);

        // 3. Bấm Save Changes
        const saveBtn = await this.driver.findElement(By.xpath("//button[contains(., 'Save Changes')]"));
        await saveBtn.click();
        await this.driver.sleep(2000);

        // 4. Đợi thông báo thành công hoặc thất bại (Sonner dùng data-sonner-toast)
        const toastXpath = "//*[(contains(@class, 'toast') or @data-sonner-toast or @role='status' or @role='alert')] [contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'uccess') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'updated') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thành công') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'failed') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'lỗi')]";
        
        const toastEl = await this.driver.wait(until.elementLocated(By.xpath(toastXpath)), 10000);
        const text = await toastEl.getAttribute('textContent');
        
        if (text.toLowerCase().includes('failed') || text.toLowerCase().includes('lỗi')) {
            throw new Error(`Cập nhật Task thất bại. Thông báo từ hệ thống: ${text}`);
        }
        
        await this.driver.sleep(2000);
    }

    async rollbackEmployeeAPI(name) {
        const result = await this.driver.executeAsyncScript(async (empName, callback) => {
            try {
                // Lấy token và URL
                const token = localStorage.getItem('accessToken');
                if (!token) return callback({ success: false, message: 'Không tìm thấy accessToken trong trình duyệt' });

                const userStr = localStorage.getItem('user');
                const userId = userStr ? JSON.parse(userStr).id : '';

                const apiUrl = 'http://localhost:5000/api';

                // 1. Tìm Employee
                const getResp = await fetch(`${apiUrl}/employees`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const getData = await getResp.json();
                const employees = getData.data || getData.employees || [];
                const emp = employees.find(e => e.name === empName);
                
                if (!emp) return callback({success: true, message: 'Không tìm thấy employee để xóa (đã được dọn dẹp hoặc chưa tạo)'});
                
                // 2. Xóa Employee
                const delResp = await fetch(`${apiUrl}/employees/${emp.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                callback({success: true, message: `Đã xóa thành công nhân viên ID: ${emp.id}`});
            } catch (e) {
                callback({success: false, message: e.message});
            }
        }, name);

        if (!result.success) {
            throw new Error(result.message);
        }
        
        return result;
    }
}

module.exports = TasksPage;
