## 1. Phạm vi kiểm thử (Scope)

Lựa chọn 4 API có tần suất sử dụng cao nhất và tác động kinh doanh lớn nhất:

| # | API Endpoint | Method | Lý do ưu tiên |
| :---: | :--- | :---: | :--- |
| 1 | `POST /api/auth/login` | POST | Điểm vào duy nhất, tắc nghẽn ảnh hưởng toàn hệ thống |
| 2 | `GET /api/tasks?userId={id}` | GET | Gọi mỗi lần load Dashboard, tần suất cao nhất |
| 3 | `GET /api/dashboard/stats` | GET | Query tổng hợp nhiều bảng DB, dễ gây bottleneck |
| 4 | `GET /api/employees` + `POST /api/employees` | GET/POST | Vòng lặp Read-Write trên DB — đại diện cho mọi tác vụ CRUD thuần túy |

**Ngoài phạm vi:** Gmail OAuth flow, Webhook Telegram/Zalo (phụ thuộc bên thứ ba), Meetings (phụ thuộc Google Calendar API), `POST /api/data-analyst/upload` và `POST /api/data-analyst/ask` (yêu cầu OpenAI API key — không khả dụng trong môi trường test).



## 2. Kịch bản kiểm thử (Test Scenarios)

### Scenario 1 — Normal User Journey (Load Test)

> **Mô tả:** Mô phỏng hành trình người dùng điển hình: Đăng nhập → Xem Dashboard → Xem Task List.  
> **VU:** 100 users đồng thời | **Duration:** 10 phút | **Ramp-Up:** 60 giây

```
Thread Group: SC-01 Normal User Journey
│
├── [1] HTTP Request — POST /api/auth/login
│     Body (JSON): {"email": "${email}", "password": "${password}"}
│     ↳ Dùng CSV Data Set Config: users.csv [email, password, userId]
│     ↳ Assertion: Response Code = 200, Body contains "accessToken" (cookie set)
│
├── [Timer] Constant Timer: 1000ms (Think Time)
│
├── [2] HTTP Request — GET /api/dashboard/stats
│     (Cookie Manager tự đính accessToken)
│     ↳ Assertion: Response Code = 200, Body contains "stats"
│
├── [Timer] Constant Timer: 800ms
│
├── [3] HTTP Request — GET /api/tasks?userId=${userId}
│     ↳ Assertion: Response Code = 200, Body contains "tasks"
│
└── [Timer] Uniform Random Timer: 500–1500ms
```

**CSV Data Set Config (`users.csv`):**
```
email,password,userId
user1@test.com,Test@1234,1
user2@test.com,Test@1234,2
...
user100@test.com,Test@1234,100
```

---

### Scenario 2 — Employee CRUD Stress Test (Stress Test)

> **Mô tả:** Mô phỏng tải Read-Write đồng thời lên DB qua module Employee — thuần DB, không phụ thuộc dịch vụ bên ngoài. Tăng tải liên tục đến khi hệ thống không thể xử lý.  
> **VU:** Bắt đầu 10, tăng 10 VU mỗi 30 giây đến tối đa 100 VU  
> **Tool:** Stepping Thread Group (jpgc plugin)

```
Thread Group: SC-02 Employee CRUD Stress Test
│
├── [1] HTTP Request — POST /api/auth/login
│     Body: {"email": "${email}", "password": "${password}"}
│     ↳ Assertion: Response Code = 200, cookie accessToken được set
│
├── [Timer] Constant Timer: 500ms
│
├── [2] HTTP Request — GET /api/employees
│     (Cookie Manager tự đính accessToken)
│     ↳ Assertion: Response Code = 200, Body contains "data"
│
├── [Timer] Constant Timer: 300ms
│
├── [3] HTTP Request — POST /api/employees
│     Body (JSON):
│     {
│       "name": "StressUser_${__threadNum}",
│       "platform": 1,
│       "uid_platform": "uid_${__Random(100000,999999)}"
│     }
│     ↳ Assertion: Response Code = 201, Body contains "success"
│
└── [Timer] Constant Timer: 500ms
```

**Stepping Thread Group Config:**
```
This Group will start: 10 threads
First, wait for: 0 seconds
Then start: 10 threads
Next, add thread every: 30 seconds using ramp-up: 10 seconds
Hold load for: 60 seconds
Stop threads incrementally, every: 10 threads per 5 seconds
```

> **Lưu ý dọn dữ liệu:** Sau khi chạy test, chạy lệnh SQL `DELETE FROM employees WHERE name LIKE 'StressUser_%';` để xóa dữ liệu rác khỏi DB.

---

### Scenario 3 — Authentication Spike Test

> **Mô tả:** Kiểm tra hệ thống auth dưới tải đột biến (spike) — mô phỏng kịch bản nhiều user đăng nhập cùng lúc vào giờ cao điểm (đầu giờ làm việc).  
> **VU:** 0 → 200 trong 10 giây → duy trì 60 giây → về 0

```
Thread Group: SC-03 Auth Spike Test
│
├── [1] HTTP Request — POST /api/auth/login
│     Body: {"email": "${email}", "password": "${password}"}
│     ↳ Assertion: Response Code = 200 | 401 (không chấp nhận 5xx)
│
└── [2] HTTP Request — GET /api/auth/profile
      ↳ Assertion: Response Code = 200
```

**Cấu hình Spike:** Dùng **Ultimate Thread Group** (jpgc):
```
Row 1: Start 0 threads, ramp to 200 in 10 sec, hold 60 sec, ramp to 0 in 5 sec
```

---

## 3. Tiêu chí đánh giá (Pass / Fail Criteria)

### 3.1 Ngưỡng chấp nhận theo từng API

| API Endpoint | Avg Response Time | 90th Percentile (P90) | Error Rate |
| :--- | :---: | :---: | :---: |
| `POST /api/auth/login` | ≤ 500 ms | ≤ 800 ms | < 1% |
| `GET /api/tasks` | ≤ 300 ms | ≤ 500 ms | < 1% |
| `GET /api/dashboard/stats` | ≤ 800 ms | ≤ 1200 ms | < 1% |
| `GET /api/employees` | ≤ 300 ms | ≤ 500 ms | < 1% |
| `POST /api/employees` | ≤ 500 ms | ≤ 800 ms | < 1% |

### 3.2 Ngưỡng hệ thống tổng thể

| Metric | Threshold | Mức Pass |
| :--- | :--- | :---: |
| **Overall Error Rate** | < 1% trong Load Test | ✅ |
| **Overall Error Rate** | < 5% tại breaking point trong Stress Test | ✅ |
| **Throughput (TPS)** | ≥ 50 requests/sec (SC-01, 100 VU) | ✅ |
| **95th Percentile** | ≤ 2x so với Avg Response Time | ✅ |
| **Server Recovery** | Sau khi giảm tải, Error Rate về < 1% trong vòng 30 giây | ✅ |
| **Memory Leak** | Không tăng Memory liên tục qua các interval 2 phút | ✅ |

### 3.3 Định nghĩa kết quả

| Kết quả | Điều kiện |
| :--- | :--- |
| **PASS** | Tất cả metrics đạt ngưỡng tương ứng với loại test |
| **CONDITIONAL PASS** | ≤ 2 metric vượt ngưỡng ≤ 20%, không có HTTP 5xx > 1% |
| **FAIL** | Bất kỳ API nào có Error Rate > ngưỡng, hoặc hệ thống unresponsive (timeout toàn bộ) |