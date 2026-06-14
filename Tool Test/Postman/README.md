
---
## I. BẢNG KỊCH BẢN KIỂM THỬ (TEST CASES) VÀ KẾT QUẢ THỰC TẾ

| STT | Mã Test Case | API / Phương Thức | Trường hợp test | Tiền Điều Kiện | Mục tiêu test | Input / Request | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | TC_TASK_001 | GET /tasks | Happy Path | Đã đăng nhập | Kiểm tra lấy danh sách task thành công | Query: `userId={{userIdA}}`, `page=1`, `limit=10` | Status 200. Trả về `status="success"`, `tasks` là một mảng. | Đúng như mong đợi | **PASS** |
| 2 | TC_TASK_002 | GET /tasks | Happy Path | Đã đăng nhập | Kiểm tra bộ lọc theo priority | Query: `userId={{userIdA}}`, `priority=high` | Mảng `tasks` trả về chỉ chứa các object có `priority="high"`. | Trả về tất cả loại task. | **FAIL** |
| 3 | TC_TASK_003 | GET /tasks | Edge Case | Đã đăng nhập | Kiểm tra phân trang vượt ngưỡng | Query: `userId={{userIdA}}`, `page=9999`, `limit=10` | Status 200. Mảng `tasks` trả về rỗng `[]`. | Kết quả đúng mong đợi | **PASS** |
| 4 | TC_TASK_004 | PUT /tasks/complete | Happy Path | Đã đăng nhập | Kiểm tra hoàn thành task | Body: `userId={{userIdA}}`, `taskId={{taskId}}`, `status="done"` | Status 200. Trả về `message="Task updated successfully"`, status="done". | Kết quả đúng mong đợi | **PASS** |
| 5 | TC_TASK_005 | PUT /tasks/complete | Sad Path | Đã đăng nhập | Kiểm tra Task ID không tồn tại | Body: `userId={{userIdA}}`, `taskId={{invalidTaskId}}` | Status 400. Trả về `error="Task không tồn tại"`. | Giống với mong đợi | **PASS** |
| 6 | TC_TASK_006 | PUT /tasks/complete | Sad Path | User B đăng nhập | Kiểm tra bảo mật xuyên quyền | Body: `userId={{userIdB}}`, `taskId={{taskId}}` (của User A) | Status 403. Trả về `error="Bạn không có quyền cập nhật task này"`. | Giống với mong đợi | **PASS** |
| 7 | TC_TASK_007 | PUT /tasks/update | Happy Path | Đã đăng nhập | Kiểm tra cập nhật description | Body: `userId={{userIdA}}`, `taskId={{taskId}}`, `description="Updated detail"` | Status 200. Data trả về có `description="Updated detail"`. | Giống với mong đợi | **PASS** |
| 8 | TC_TASK_008 | PUT /tasks/update | Sad Path | Đã đăng nhập | Kiểm tra thiếu trường bắt buộc | Body: `{}` | Status 400. Trả về mảng `errors`. | Giống với mong đợi | **PASS** |
| 9 | TC_TASK_009 | PUT /tasks/reminders | Sad Path | Đã đăng nhập | Kiểm tra mảng taskIDs rỗng | Body: `userId={{userIdA}}`, `taskIds=[]` | Status 400. Trả về `message="No tasks selected"`. | Giống với mong đợi | **PASS** |
| 10 | TC_TASK_010 | POST /tasks/reminders | Happy Path | Đã đăng nhập | Kiểm tra gửi nhắc nhở qua bot | Body: `userId={{userIdA}}`, `taskIds=["{{taskId}}"]` | Status 200. `results` có trạng thái `sent/skipped/failed`. | Giống với mong đợi | **PASS** |

---

## II. CHI TIẾT POSTMAN TEST SCRIPTS

### 1. API: GET /tasks

**Request 1.1: Lấy danh sách & Lưu TaskId**
```javascript
pm.test("Status 200 & Correct structure", function () {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
    pm.expect(jsonData.tasks).to.be.an("array");
});

var jsonData = pm.response.json();
if(jsonData.tasks && jsonData.tasks.length > 0) {
    pm.environment.set("taskId", jsonData.tasks[0].task_id);
}
```

**Request 1.2: Lọc Priority**
```javascript
pm.test("Only returns HIGH priority tasks", function () {
    var jsonData = pm.response.json();
    jsonData.tasks.forEach(function(task) {
        pm.expect(task.priority).to.eql("high");
    });
});
```

**Request 1.3: Phân trang biên**
```javascript
pm.test("Status 200 but empty array", function () {
    pm.response.to.have.status(200);
    pm.expect(pm.response.json().tasks).to.be.empty;
});
```

### 2. API: PUT /tasks/complete

**Request 2.1: Thành công**
```javascript
pm.test("Task completed successfully", function () {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.expect(jsonData.message).to.eql("Task updated successfully");
    pm.expect(jsonData.task.status).to.eql("completed");
});
```

**Request 2.2: Sai ID**
```javascript
pm.test("Returns 400 - Task not found", function () {
    pm.response.to.have.status(400);
    pm.expect(pm.response.json().error).to.eql("Task không tồn tại");
});
```

**Request 2.3: Xuyên quyền**
```javascript
pm.test("Returns 403 - Forbidden", function () {
    pm.response.to.have.status(403);
    pm.expect(pm.response.json().error).to.eql("Bạn không có quyền cập nhật task này");
});
```

### 3. API: PUT /tasks/update

**Request 3.1: Thành công**
```javascript
pm.test("Task updated successfully", function () {
    pm.response.to.have.status(200);
    pm.expect(pm.response.json().task.description).to.eql("Updated detail");
});
```

**Request 3.2: Lỗi Validation**
```javascript
pm.test("Returns 400 - Validation Errors", function () {
    pm.response.to.have.status(400);
    pm.expect(pm.response.json()).to.have.property("errors");
    pm.expect(pm.response.json().errors).to.be.an("array");
});
```

### 4. API: POST /tasks/reminders

**Request 4.1: Thiếu TaskIds**
```javascript
pm.test("Returns 400 - No tasks selected", function () {
    pm.response.to.have.status(400);
    pm.expect(pm.response.json().message).to.eql("No tasks selected");
});
```

**Request 4.2: Xử lý Remind**
```javascript
pm.test("Reminders processed", function () {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
    if(jsonData.results.length > 0) {
        var status = jsonData.results[0].status;
        pm.expect(["sent", "skipped", "failed"]).to.include(status);
    }
});
```

---