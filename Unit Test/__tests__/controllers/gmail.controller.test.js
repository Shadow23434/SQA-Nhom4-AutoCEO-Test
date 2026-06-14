import dotenv from "dotenv";
dotenv.config();
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../app.js";
import db from "../config/db.js";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

// MOCK: Chặn không cho gọi hàm xóa Cache thật để cô lập Unit Test
jest.mock("../controllers/dashboard.controller.js", () => ({
  invalidateDashboardCache: jest.fn(),
}));

describe("Unit Test Chuẩn SQA: Gmail Controller (Max Coverage)", () => {
  const user1_Id = uuidv4();
  const user2_Id = uuidv4();
  const fake_UserId = uuidv4(); // Dùng để test user không tồn tại

  const email1_U1 = uuidv4(); 
  const email2_U1 = uuidv4(); 
  const email3_U2 = uuidv4(); 

  // Token chuẩn có userId
  const authRequest = (method, url, userId) => {
    const token = jwt.sign({ id: userId, userId: userId }, process.env.JWT_SECRET || "supersecretkey");
    return request(app)[method](url)
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", `accessToken=${token}`);
  };

  // Token KHÔNG CÓ trường id để test lỗi 401
  const noUserIdRequest = (method, url) => {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET || "supersecretkey");
    return request(app)[method](url).set("Authorization", `Bearer ${token}`);
  };

  beforeEach(async () => {
    await db.query("BEGIN");

    await db.query(
      `INSERT INTO users (id, gmail, password, name) VALUES 
      ($1, 'user1@test.com', 'hash', 'User 1'),
      ($2, 'user2@test.com', 'hash', 'User 2')`,
      [user1_Id, user2_Id]
    );

    // Gán thêm field received_at để test bộ lọc Date
    await db.query(
      `INSERT INTO emails (id, email_id, user_id, status, is_seen, created_at, received_at) VALUES 
      ($1, 'GMAIL_001', $2, 'medium', false, NOW(), '2026-05-10 10:00:00'),
      ($3, 'GMAIL_002', $2, 'high', false, NOW(), NOW()),
      ($4, 'GMAIL_003', $5, 'medium', false, NOW(), NOW())`,
      [email1_U1, user1_Id, email2_U1, email3_U2, user2_Id]
    );
  });

  afterEach(async () => {
    await db.query("ROLLBACK");
    jest.restoreAllMocks(); 
  });

  afterAll(async () => {
    await db.end();
  });

  // =================================================================
  // 1. TEST: listEmails
  // =================================================================
  describe("1. GET /api/gmail/list", () => {
    it("[TC_GMAIL_01] Lấy danh sách email thành công (Bảo mật IDOR)", async () => {
      const response = await authRequest('get', '/api/gmail/list', user1_Id);
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
      const isHacked = response.body.data.some(e => e.id === email3_U2);
      expect(isHacked).toBeFalsy(); 
    });

    it("[TC_GMAIL_02] Lọc email theo trạng thái (status=high)", async () => {
      const response = await authRequest('get', '/api/gmail/list?status=high', user1_Id);
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe("high");
    });

    it("[TC_GMAIL_03] Lọc email theo ngày (date)", async () => {
      // Test nhánh if (date)
      const response = await authRequest('get', '/api/gmail/list?date=2026-05-10', user1_Id);
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1); // Ít nhất 1 email (GMAIL_001) khớp ngày này
    });

    it("[TC_GMAIL_04] Báo lỗi 401 khi token không chứa userId", async () => {
      const response = await noUserIdRequest('get', '/api/gmail/list');
      expect(response.status).toBe(401);
    });

    it("[TC_GMAIL_05] Báo lỗi 500 khi truy vấn danh sách DB thất bại", async () => {
      jest.spyOn(db, 'query').mockRejectedValueOnce(new Error("DB Error"));
      const response = await authRequest('get', '/api/gmail/list', user1_Id);
      expect(response.status).toBe(500);
    });
  });

  // =================================================================
  // 2. TEST: updateSeenStatus
  // =================================================================
  describe("2. PATCH /api/gmail/update-seen", () => {
    it("[TC_GMAIL_06] Cập nhật trạng thái đã xem thành công", async () => {
      const payload = { emailId: email1_U1, isSeen: true };
      const response = await authRequest('patch', '/api/gmail/update-seen', user1_Id).send(payload);
      
      expect(response.status).toBe(200);
      const checkDb = await db.query(`SELECT is_seen FROM emails WHERE id = $1`, [email1_U1]);
      expect(checkDb.rows[0].is_seen).toBe(true);
    });

    it("[TC_GMAIL_07] Báo lỗi 404 khi cố tình sửa email của người khác (IDOR)", async () => {
      const payload = { emailId: email3_U2, isSeen: true };
      const response = await authRequest('patch', '/api/gmail/update-seen', user1_Id).send(payload);
      expect(response.status).toBe(404);
    });

    it("[TC_GMAIL_08] Báo lỗi 400 khi truyền thiếu emailId hoặc sai kiểu isSeen", async () => {
      const response1 = await authRequest('patch', '/api/gmail/update-seen', user1_Id).send({ isSeen: true }); // Thiếu emailId
      const response2 = await authRequest('patch', '/api/gmail/update-seen', user1_Id).send({ emailId: email1_U1, isSeen: "yes" }); // Sai kiểu boolean
      
      expect(response1.status).toBe(400);
      expect(response2.status).toBe(400);
    });

    it("[TC_GMAIL_09] Báo lỗi 401 khi token không chứa userId", async () => {
      const response = await noUserIdRequest('patch', '/api/gmail/update-seen').send({ emailId: email1_U1, isSeen: true });
      expect(response.status).toBe(401);
    });

    it("[TC_GMAIL_10] Báo lỗi 500 khi cập nhật trạng thái DB thất bại", async () => {
      jest.spyOn(db, 'query').mockRejectedValueOnce(new Error("DB Error"));
      const response = await authRequest('patch', '/api/gmail/update-seen', user1_Id).send({ emailId: email1_U1, isSeen: true });
      expect(response.status).toBe(500);
    });
  });

  // =================================================================
  // 3. TEST: saveEmails
  // =================================================================
  describe("3. POST /api/gmail/save", () => {
    it("[TC_GMAIL_11] Lưu và Cập nhật danh sách email hợp lệ", async () => {
      const payload = {
        userId: user1_Id,
        emails: [
          { email_id: "GMAIL_001", status: "low" }, 
          { email_id: "GMAIL_NEW", status: "high" } 
        ]
      };
      const response = await authRequest('post', '/api/gmail/save', user1_Id).send(payload);

      // Nghiệp vụ kỳ vọng 200. Nếu code Dev thiếu created_at gây sập DB, nó sẽ văng 500 (Fail đúng thực tế)
      expect(response.status).toBe(200); 
    });

    it("[TC_GMAIL_12] Báo lỗi 400 khi gửi payload không chứa array emails", async () => {
      const payload = { userId: user1_Id, emails: "not_an_array" };
      const response = await authRequest('post', '/api/gmail/save', user1_Id).send(payload);
      expect(response.status).toBe(400);
    });

    it("[TC_GMAIL_13] Báo lỗi 400 khi thiếu email_id hoặc status trong mảng", async () => {
      const payload = {
        userId: user1_Id,
        emails: [{ email_id: "GMAIL_ERR" }] // Thiếu status
      };
      const response = await authRequest('post', '/api/gmail/save', user1_Id).send(payload);
      expect(response.status).toBe(400);
    });

    it("[TC_GMAIL_14] Báo lỗi 400 khi userId không tồn tại trong hệ thống", async () => {
      const payload = {
        userId: fake_UserId, // User ảo không có trong DB
        emails: [{ email_id: "GMAIL_NEW", status: "high" }]
      };
      const response = await authRequest('post', '/api/gmail/save', user1_Id).send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error.toLowerCase()).toContain("không tồn tại");
    });

    it("[TC_GMAIL_15] Báo lỗi 500 khi lưu email vào DB thất bại", async () => {
      jest.spyOn(db, 'query')
        .mockResolvedValueOnce({ rows: [{ id: user1_Id }] }) // Qua ải check User
        .mockRejectedValueOnce(new Error("DB Error")); // Sập ở bước lưu Email

      const payload = { userId: user1_Id, emails: [{ email_id: "GMAIL_NEW", status: "high" }] };
      const response = await authRequest('post', '/api/gmail/save', user1_Id).send(payload);
      expect(response.status).toBe(500);
    });
  });
});