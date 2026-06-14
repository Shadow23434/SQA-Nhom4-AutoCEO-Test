import dotenv from "dotenv";
dotenv.config();
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../app.js"; 
import db from "../config/db.js";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

describe("Unit Test: Employee Controller", () => {
  // --- Khởi tạo dữ liệu mock ---
  const user1_Id = uuidv4();
  const user2_Id = uuidv4(); 
  const emp1_U1 = uuidv4(); 
  const emp2_U1 = uuidv4(); 
  const emp3_U2 = uuidv4(); 
  const fakeId = uuidv4();

  // Hàm hỗ trợ tạo request với token hợp lệ
  const authRequest = (method, url, userId) => {
    const token = jwt.sign({ id: userId, userId: userId }, process.env.JWT_SECRET || "supersecretkey");
    return request(app)[method](url)
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", `accessToken=${token}`);
  };

  // Hàm hỗ trợ tạo request với token thiếu userId để test validation
  const noUserIdRequest = (method, url) => {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET || "supersecretkey");
    return request(app)[method](url).set("Authorization", `Bearer ${token}`);
  };

  beforeEach(async () => {
    await db.query("BEGIN"); 
    
    await db.query(
      `INSERT INTO users (id, gmail, password, name) VALUES 
      ($1, 'user1@test.com', 'hash1', 'User 1'),
      ($2, 'user2@test.com', 'hash2', 'User 2')`,
      [user1_Id, user2_Id]
    );
    
    await db.query(
      `INSERT INTO employees (id, name, platform, uid_platform, user_id, created_at, updated_at) VALUES 
      ($1, 'Nhân viên 1', 2, 'ZALO_001', $2, NOW(), NOW()),
      ($3, 'Nhân viên 2', 1, 'TELE_002', $2, NOW(), NOW()),
      ($4, 'Nhân viên Hacker', 2, 'ZALO_HACK', $5, NOW(), NOW())`,
      [emp1_U1, user1_Id, emp2_U1, emp3_U2, user2_Id]
    );
  });

  afterEach(async () => {
    await db.query("ROLLBACK"); 
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await db.end();
  });

  // --- Nhóm Test Case: Nghiệp vụ chính (CRUD) ---

  describe("1. GET /api/employees", () => {
    it("[TC_EMP_01] Lấy danh sách nhân viên thành công", async () => {
      const response = await authRequest('get', '/api/employees', user1_Id);
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe("2. GET /api/employees/:id", () => {
    it("[TC_EMP_02] Xem chi tiết nhân viên hợp lệ", async () => {
      const response = await authRequest('get', `/api/employees/${emp1_U1}`, user1_Id);
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(emp1_U1);
    });

    it("[TC_EMP_03] Từ chối xem chi tiết nhân viên của người khác (IDOR)", async () => {
      const response = await authRequest('get', `/api/employees/${emp3_U2}`, user1_Id);
      expect(response.status).toBe(404);
    });
  });

  describe("3. POST /api/employees", () => {
    it("[TC_EMP_04] Tạo mới nhân viên thành công", async () => {
      const payload = { name: "Mới", date_of_birth: "1990-01-01", platform: 2, uid_platform: "ZALO_NEW" };
      const response = await authRequest('post', '/api/employees', user1_Id).send(payload);
      expect(response.status).toBe(201);

      // CheckDB: Đảm bảo dữ liệu thực sự được lưu
      const newEmpId = response.body.data.id;
      const checkDb = await db.query(`SELECT uid_platform FROM employees WHERE id = $1`, [newEmpId]);
      expect(checkDb.rowCount).toBe(1);
      expect(checkDb.rows[0].uid_platform).toBe("ZALO_NEW");
    });

    it("[TC_EMP_05] Báo lỗi khi tạo mới trùng UID Platform", async () => {
      const payload = { name: "Copy", date_of_birth: "1990-01-01", platform: 2, uid_platform: "ZALO_001" };
      const response = await authRequest('post', '/api/employees', user1_Id).send(payload);
      expect(response.status).toBe(400);

      // CheckDB: Đảm bảo không có dòng rác nào được lưu
      const checkDb = await db.query(`SELECT id FROM employees WHERE uid_platform = 'ZALO_001' AND user_id = $1`, [user1_Id]);
      expect(checkDb.rowCount).toBe(1); // Chỉ còn 1 dòng gốc, không tăng lên 2
    });
  });

  describe("4. PUT /api/employees/:id", () => {
    it("[TC_EMP_06] Cập nhật thông tin nhân viên thành công", async () => {
      const payload = { name: "Update", platform: 2 }; 
      const response = await authRequest('put', `/api/employees/${emp1_U1}`, user1_Id).send(payload);
      expect(response.status).toBe(200);

      // CheckDB: Đảm bảo CSDL được cập nhật đúng tên mới
      const checkDb = await db.query(`SELECT name FROM employees WHERE id = $1`, [emp1_U1]);
      expect(checkDb.rows[0].name).toBe("Update");
    });

    it("[TC_EMP_07] Báo lỗi khi cập nhật trùng UID Platform", async () => {
      const payload = { uid_platform: "TELE_002", platform: 1 };
      const response = await authRequest('put', `/api/employees/${emp1_U1}`, user1_Id).send(payload);
      expect(response.status).toBe(400);

      // CheckDB: Đảm bảo UID cũ không bị đổi
      const checkDb = await db.query(`SELECT uid_platform FROM employees WHERE id = $1`, [emp1_U1]);
      expect(checkDb.rows[0].uid_platform).toBe("ZALO_001");
    });

    it("[TC_EMP_08] Từ chối cập nhật nhân viên của người khác (IDOR)", async () => {
      const response = await authRequest('put', `/api/employees/${emp3_U2}`, user1_Id).send({ name: "Hacked" });
      expect(response.status).toBe(403);

      // CheckDB: Đảm bảo tên của người bị hack không bị đổi
      const checkDb = await db.query(`SELECT name FROM employees WHERE id = $1`, [emp3_U2]);
      expect(checkDb.rows[0].name).toBe("Nhân viên Hacker"); 
    });

    it("[TC_EMP_09] Báo lỗi 404 khi cập nhật nhân viên không tồn tại", async () => {
      const response = await authRequest('put', `/api/employees/${fakeId}`, user1_Id).send({ name: "Hacked" });
      expect(response.status).toBe(404);
    });
  });

  describe("5. DELETE /api/employees/:id", () => {
    it("[TC_EMP_10] Xóa nhân viên thành công", async () => {
      const response = await authRequest('delete', `/api/employees/${emp1_U1}`, user1_Id);
      expect(response.status).toBe(200);

      // CheckDB: Đảm bảo nhân viên đã bay màu khỏi CSDL
      const checkDb = await db.query(`SELECT * FROM employees WHERE id = $1`, [emp1_U1]);
      expect(checkDb.rowCount).toBe(0);
    });

    it("[TC_EMP_11] Từ chối xóa nhân viên của người khác (IDOR)", async () => {
      const response = await authRequest('delete', `/api/employees/${emp3_U2}`, user1_Id);
      expect(response.status).toBe(403);

      // CheckDB: Đảm bảo dữ liệu người khác vẫn an toàn
      const checkDb = await db.query(`SELECT * FROM employees WHERE id = $1`, [emp3_U2]);
      expect(checkDb.rowCount).toBe(1);
    });

    it("[TC_EMP_12] Báo lỗi 404 khi xóa nhân viên không tồn tại", async () => {
      const response = await authRequest('delete', `/api/employees/${fakeId}`, user1_Id);
      expect(response.status).toBe(404);
    });
  });

  // --- Nhóm Test Case: Kiểm tra các nhánh ngoại lệ (Validation, Exception, Database Error) ---

  describe("6. Kiểm tra quyền truy cập và Validation data", () => {
    it("[TC_EMP_13] Trả về 401 khi token không chứa userId", async () => {
      const validPayload = { name: "Test", date_of_birth: "1990-01-01", platform: 1, uid_platform: "TEST" };
      
      const res1 = await noUserIdRequest('get', '/api/employees');
      const res2 = await noUserIdRequest('get', `/api/employees/${emp1_U1}`);
      const res3 = await noUserIdRequest('post', '/api/employees').send(validPayload);
      const res4 = await noUserIdRequest('put', `/api/employees/${emp1_U1}`).send(validPayload);
      const res5 = await noUserIdRequest('delete', `/api/employees/${emp1_U1}`);

      expect(res1.status).toBe(401);
      expect(res2.status).toBe(401);
      expect(res3.status).toBe(401);
      expect(res4.status).toBe(401);
      expect(res5.status).toBe(401);
    });

    it("[TC_EMP_14] Trả về 400 khi body request không hợp lệ (Validation)", async () => {
      const resPost = await authRequest('post', '/api/employees', user1_Id).send({});
      expect(resPost.status).toBe(400);

      const resPut = await authRequest('put', `/api/employees/${emp1_U1}`, user1_Id).send({ platform: 'invalid_string' });
      expect(resPut.status).toBe(400);
    });
  });

  describe("7. Kiểm tra xử lý lỗi hệ thống (DB error, Exception)", () => {
    it("[TC_EMP_15] Xử lý lỗi 500 khi DB truy vấn danh sách thất bại", async () => {
      jest.spyOn(db, 'query').mockRejectedValueOnce(new Error("DB Error"));
      const res = await authRequest('get', '/api/employees', user1_Id);
      expect(res.status).toBe(500);
    });

    it("[TC_EMP_16] Xử lý lỗi 500 khi DB truy vấn chi tiết thất bại", async () => {
      jest.spyOn(db, 'query').mockRejectedValueOnce(new Error("DB Error"));
      const res = await authRequest('get', `/api/employees/${emp1_U1}`, user1_Id);
      expect(res.status).toBe(500);
    });

    it("[TC_EMP_17] Xử lý lỗi 500 khi lưu nhân viên mới thất bại", async () => {
      jest.spyOn(db, 'query')
        .mockResolvedValueOnce({ rows: [] }) 
        .mockRejectedValueOnce(new Error("Insert Error"));

      const res = await authRequest('post', '/api/employees', user1_Id).send({ name: "A", date_of_birth: "2000-01-01", platform: 2, uid_platform: "A1" });
      expect(res.status).toBe(500);
    });

    it("[TC_EMP_18] Xử lý lỗi 500 khi cập nhật nhân viên thất bại", async () => {
      jest.spyOn(db, 'query')
        .mockResolvedValueOnce({ rows: [{ id: emp1_U1, user_id: user1_Id }] }) 
        .mockResolvedValueOnce({ rows: [] }) 
        .mockRejectedValueOnce(new Error("Update Error"));

      const res = await authRequest('put', `/api/employees/${emp1_U1}`, user1_Id).send({ name: "B", platform: 2, uid_platform: "B1" });
      expect(res.status).toBe(500);
    });

    it("[TC_EMP_19] Xử lý lỗi 500 khi xóa nhân viên thất bại", async () => {
      jest.spyOn(db, 'query')
        .mockResolvedValueOnce({ rows: [{ id: emp1_U1, user_id: user1_Id }] }) 
        .mockRejectedValueOnce(new Error("Delete Error"));

      const res = await authRequest('delete', `/api/employees/${emp1_U1}`, user1_Id);
      expect(res.status).toBe(500);
    });

    it("[TC_EMP_20] Xử lý lỗi DB 23505 (Unique Constraint) khi tạo mới", async () => {
      jest.spyOn(db, 'query')
        .mockResolvedValueOnce({ rows: [] }) 
        .mockRejectedValueOnce({ code: '23505' }); 

      const res = await authRequest('post', '/api/employees', user1_Id).send({ name: "A", date_of_birth: "2000-01-01", platform: 2, uid_platform: "A1" });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("đã tồn tại");
    });

    it("[TC_EMP_21] Xử lý lỗi DB 23505 (Unique Constraint) khi cập nhật", async () => {
      jest.spyOn(db, 'query')
        .mockResolvedValueOnce({ rows: [{ id: emp1_U1, user_id: user1_Id }] }) 
        .mockResolvedValueOnce({ rows: [] }) 
        .mockRejectedValueOnce({ code: '23505' }); 

      const res = await authRequest('put', `/api/employees/${emp1_U1}`, user1_Id).send({ name: "B", platform: 2, uid_platform: "B1" });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("đã tồn tại");
    });
  });
});