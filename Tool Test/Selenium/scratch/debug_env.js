const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env');
console.log('--- Debug Environment ---');
console.log('Thư mục hiện tại:', __dirname);
console.log('Đường dẫn file .env dự kiến:', envPath);
console.log('File .env có tồn tại không?:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
    console.log('Nội dung file .env (ẩn thông tin nhạy cảm):');
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
            const [key] = line.split('=');
            console.log(`- Tìm thấy key: ${key}`);
        }
    });

    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.error('Lỗi khi load dotenv:', result.error);
    } else {
        console.log('Load dotenv thành công!');
        console.log('TEST_EMAIL từ process.env:', process.env.TEST_EMAIL);
        console.log('BASE_URL từ process.env:', process.env.BASE_URL);
    }
}
