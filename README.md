# SQA-Nhom4-AutoCEO-Test

Bộ kiểm thử tự động cho hệ thống **AutoCEO** — nền tảng quản lý tác vụ, nhân viên và tích hợp đa nền tảng (ClickUp, Telegram, Zalo) dành cho CEO.

Dự án thuộc môn **Đảm bảo Chất lượng Phần mềm (SQA)**.

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cài đặt](#cài-đặt)
- [Chạy kiểm thử](#chạy-kiểm-thử)
  - [Unit Test](#1-unit-test)
  - [Selenium UI Test](#2-selenium-ui-test)
  - [Postman API Test](#3-postman-api-test)
  - [JMeter Load Test](#4-jmeter-load-test)
- [Phạm vi kiểm thử](#phạm-vi-kiểm-thử)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)

---

## Tổng quan

Dự án bao gồm **3 tầng kiểm thử** cho hệ thống AutoCEO:

| Tầng                        | Công cụ            | Mô tả                                                   |
| --------------------------- | ------------------ | ------------------------------------------------------- |
| **Unit Test**               | Jest               | Kiểm thử controllers, middleware, utilities của backend |
| **API / Integration Test**  | Postman            | Kiểm thử API endpoints với assertions                   |
| **Performance / Load Test** | Apache JMeter      | Kiểm thử tải, stress, spike với virtual users           |
| **UI Automation Test**      | Selenium WebDriver | Kiểm thử end-to-end trên giao diện người dùng           |

---

## Cấu trúc dự án

```
SQA-Nhom4-AutoCEO-Test/
├── Unit Test/
│   └── __tests__/
│       ├── controllers/          # 12 bộ test controllers
│       │   ├── auth.controller.test.js
│       │   ├── botConfig.controller.test.js
│       │   ├── dashboard.controller.test.js
│       │   ├── employee.controller.test.js
│       │   ├── gmail.controller.test.js
│       │   ├── meetings.controller.test.js
│       │   ├── notification.controller.test.js
│       │   ├── platform.controller.test.js
│       │   ├── request.controller.test.js
│       │   ├── response.controller.test.js
│       │   ├── task.controller.test.js
│       │   └── webhook.controller.test.js
│       ├── middleware/
│       │   └── auth.middleware.test.js
│       └── utils/
│           ├── hash.test.js
│           └── jwt.test.js
│
├── Tool Test/
│   ├── Selenium/                 # UI automation tests
│   │   ├── pages/                # Page Object Model
│   │   │   ├── BasePage.js
│   │   │   ├── LoginPage.js
│   │   │   └── TasksPage.js
│   │   ├── specs/                # Test specifications
│   │   │   ├── login.spec.js
│   │   │   └── tasks.spec.js
│   │   ├── utils/
│   │   │   └── DriverFactory.js
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── Postman/                  # API test scripts
│   │   └── README.md
│   │
│   └── JMeter/                   # Performance test plans
│       ├── SC-01 Normal User Journey.jmx
│       ├── users.csv
│       └── README.md
│
├── .gitignore
└── README.md
```

---

## Công nghệ sử dụng

| Mục           | Công nghệ                                        |
| ------------- | ------------------------------------------------ |
| Ngôn ngữ      | JavaScript (ESM)                                 |
| Runtime       | Node.js v16+                                     |
| Unit Test     | Jest                                             |
| UI Automation | Selenium WebDriver v4.10, Mocha v10.2, Chai v4.3 |
| API Testing   | Postman (Newman-compatible)                      |
| Load Testing  | Apache JMeter                                    |
| Trình duyệt   | Google Chrome + ChromeDriver                     |
| Backend (SUT) | Express.js, PostgreSQL, JWT, bcrypt              |

---

## Cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd SQA-Nhom4-AutoCEO-Test
```

### 2. Cài đặt Selenium UI Tests

```bash
cd "Tool Test/Selenium"
npm install
```

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Cấu hình các biến môi trường trong `.env`:

| Biến            | Mặc định                | Mô tả                   |
| --------------- | ----------------------- | ----------------------- |
| `TEST_EMAIL`    | `admin@autoceo.dev`     | Email đăng nhập test    |
| `TEST_PASSWORD` | `Password123!`          | Mật khẩu đăng nhập test |
| `BASE_URL`      | `http://localhost:5173` | URL frontend AutoCEO    |
| `BROWSER`       | `chrome`                | Trình duyệt sử dụng     |

### 3. Cài đặt Unit Tests

Unit Tests được thiết kế để chạy trong project backend AutoCEO. Copy thư mục `Unit Test/__tests__/` vào project backend:

```bash
cp -r "Unit Test/__tests__" <đường-dẫn-backend>/__tests__/
```

Cài đặt Jest trong backend (nếu chưa có):

```bash
cd <đường-dẫn-backend>
npm install --save-dev jest @jest/globals
```

---

## Chạy kiểm thử

### 1. Unit Test

Chạy từ thư mục backend AutoCEO:

```bash
# Chạy tất cả unit tests
npx jest

# Chạy riêng controllers
npx jest __tests__/controllers/

# Chạy riêng middleware
npx jest __tests__/middleware/

# Chạy riêng utilities
npx jest __tests__/utils/

# Xem chi tiết với verbose
npx jest --verbose

# Xem coverage report
npx jest --coverage
```

### 2. Selenium UI Test

Chạy từ thư mục `Tool Test/Selenium`:

```bash
# Chạy tất cả tests
npm test

# Chỉ chạy login tests
npm run test:login

# Chỉ chạy tasks tests
npm run test:tasks
```

### 3. Postman API Test

Import Postman collection vào Postman Desktop hoặc chạy qua Newman CLI:

```bash
newman run <collection-file> -e <environment-file>
```

Chi tiết 10 test cases API xem tại [`Tool Test/Postman/README.md`](Tool%20Test/Postman/README.md).

### 4. JMeter Load Test

Mở file `.jmx` bằng Apache JMeter GUI hoặc chạy qua CLI:

```bash
# GUI mode
jmeter -t "Tool Test/JMeter/SC-01 Normal User Journey.jmx"

# CLI mode (non-GUI)
jmeter -n -t "Tool Test/JMeter/SC-01 Normal User Journey.jmx" -l results.jtl
```

Chi tiết 3 kịch bản load test xem tại [`Tool Test/JMeter/README.md`](Tool%20Test/JMeter/README.md).

---

## Phạm vi kiểm thử

### Unit Test Coverage (~200+ test cases)

| Module                      | Số test cases | Chức năng kiểm thử                                                                   |
| --------------------------- | :-----------: | ------------------------------------------------------------------------------------ |
| **Auth Controller**         |      ~50      | Register, login, refresh token, profile, verify email, forgot password, Google OAuth |
| **Task Controller**         |      ~27      | Filter, complete, update, send reminders (Telegram/Zalo)                             |
| **BotConfig Controller**    |      ~20      | Platform updates, bot config CRUD, Zalo webhook                                      |
| **Employee Controller**     |      ~21      | CRUD, IDOR security, unique constraint, validation                                   |
| **Meetings Controller**     |      ~16      | CRUD, pagination, cache invalidation                                                 |
| **Gmail Controller**        |      ~15      | List emails, filter by status/date, update seen                                      |
| **Webhook Controller**      |      ~15      | Telegram/Zalo webhook, employee matching, secret validation                          |
| **Platform Controller**     |      ~18      | ClickUp OAuth, connection status, unlink                                             |
| **Notification Controller** |      ~7       | Send notification, validation, task ownership                                        |
| **Request Controller**      |      ~7       | Pagination, filter by employee/date                                                  |
| **Response Controller**     |      ~7       | Pagination, filter, get by request                                                   |
| **Dashboard Controller**    |      ~9       | Stats, caching logic, stale data fallback                                            |
| **Auth Middleware**         |      ~7       | verifyToken (cookie, header, auto-refresh, expired)                                  |
| **Hash Utility**            |      ~6       | hashPassword, comparePassword (bcrypt)                                               |
| **JWT Utility**             |      ~6       | generateToken, generateRefreshToken, verifyRefreshToken                              |

### Selenium UI Test Cases (7 test cases)

| ID        | Mô tả                                           |
| --------- | ----------------------------------------------- |
| TC-SW-001 | Đăng nhập thành công với thông tin hợp lệ       |
| TC-SW-002 | Hiển thị lỗi khi nhập sai mật khẩu              |
| TC-SW-003 | Chuyển hướng về login khi truy cập route bảo vệ |
| TC-SW-004 | Chuyển đổi giữa tab Task và Employee            |
| TC-SW-005 | Mở dialog đồng bộ nền tảng (Sync Dialog)        |
| TC-SW-006 | Tạo và xóa nhân viên (có rollback)              |
| TC-SW-007 | Thay đổi người thực hiện tác vụ (có rollback)   |

### JMeter Load Test Scenarios (3 kịch bản)

| Scenario  | Loại        | Mô tả                                                    | Tiêu chí đạt                             |
| --------- | ----------- | -------------------------------------------------------- | ---------------------------------------- |
| **SC-01** | Load Test   | 100 users đồng thời, 10 phút (login → dashboard → tasks) | Login ≤ 500ms, Tasks ≤ 300ms, Error < 1% |
| **SC-02** | Stress Test | Tăng dần 10→100 VU cho Employee CRUD                     | Response time ổn định, Error < 5%        |
| **SC-03** | Spike Test  | 0→200 VU trong 10s cho Auth endpoints                    | Không crash, recovery sau spike          |

---

## Yêu cầu hệ thống

| Yêu cầu         | Phiên bản                |
| --------------- | ------------------------ |
| Node.js         | ≥ 16.0                   |
| Google Chrome   | Phiên bản mới nhất       |
| ChromeDriver    | Tương thích với Chrome   |
| Apache JMeter   | ≥ 5.5 (cho load test)    |
| Postman         | ≥ 10.0 (cho API test)    |
| Backend AutoCEO | Đang chạy trên localhost |

---
