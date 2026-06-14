# AutoCEO Automation Tests

Bộ công cụ kiểm thử tự động sử dụng **Selenium WebDriver** cho dự án AutoCEO.

## Cấu trúc thư mục
- `pages/`: Chứa các Page Objects (Locators & Actions).
- `specs/`: Chứa các kịch bản kiểm thử (Test Scripts).
- `utils/`: Các công cụ hỗ trợ (DriverFactory).
- `.env.example`: File mẫu cấu hình biến môi trường.

## Yêu cầu hệ thống
- Node.js (v16+)
- Chrome Browser
- ChromeDriver (tương ứng với phiên bản Chrome)

## Hướng dẫn cài đặt và chạy
1. Cài đặt dependencies:
   ```bash
   cd automation-tests
   npm install
   ```
2. Cấu hình biến môi trường:
   - Copy `.env.example` thành `.env`
   - Cập nhật `TEST_EMAIL` và `TEST_PASSWORD` hợp lệ.
3. Chạy tất cả các test:
   ```bash
   npm test
   ```
4. Chạy từng module riêng lẻ:
   ```bash
   npm run test:login
   npm run test:tasks
   ```

## Các Test Case đã triển khai
- **Authentication**: Đăng nhập thành công, Đăng nhập lỗi.
- **Task Management**: Điều hướng các tab, Mở dialog đồng bộ platform.
