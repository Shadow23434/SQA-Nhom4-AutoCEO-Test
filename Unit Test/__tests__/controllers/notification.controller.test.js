/**
 * Unit Test — Notification Controller
 *
 * NGUỒN ĐẶC TẢ:
 * - Swagger (notification.routes.js dòng 7-57): POST /api/notifications/send
 * - Route validation: body("taskId").notEmpty(), body("userId").notEmpty(),
 *   body("message").notEmpty()
 * - DB Schema: tasks(task_id uuid PK, user_id FK)
 *
 * PHẠM VI: 1 hàm duy nhất — sendNotification.
 */
import { sendNotification } from "../controllers/notification.controller.js";

import db from "../config/db.js";
jest.mock("../config/db.js", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import { validationResult } from "express-validator";
jest.mock("express-validator", () => ({
  validationResult: jest.fn(),
}));

// ===== HELPERS =====
const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};
const mockValidationOk = () =>
  validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
const mockValidationFail = (errors) =>
  validationResult.mockReturnValue({ isEmpty: () => false, array: () => errors });

// ================================================================
describe("Notification Controller — sendNotification", () => {
  beforeEach(() => jest.clearAllMocks());

  // ============================================================
  //  sendNotification (TC01 – TC07)
  //  Swagger: POST /send → 200/400/404/500
  // ============================================================

  // TC01: Swagger 400 — thiếu field bắt buộc.
  it("TC01 - Validation lỗi → 400 + errors[], không gọi DB", async () => {
    const req = { body: {} };
    const res = mockRes();
    mockValidationFail([
      { msg: "Task ID is required", path: "taskId" },
      { msg: "User ID is required", path: "userId" },
    ]);
    await sendNotification(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      errors: expect.arrayContaining([
        expect.objectContaining({ msg: "Task ID is required" }),
      ]),
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  // TC02: Swagger 200 — task hợp lệ, response đúng format.
  it("TC02 - Task tồn tại → 200 + Swagger response format", async () => {
    const req = { body: { taskId: "t1", userId: "u1", message: "Nhắc họp" } };
    const res = mockRes();
    mockValidationOk();
    db.query.mockResolvedValue({ rows: [{ task_id: "t1" }] });

    await sendNotification(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message: "Gửi nhắc nhở thành công",
      failedPlatforms: [],
    });
    expect(db.query).toHaveBeenCalledWith(
      "SELECT task_id FROM tasks WHERE task_id = $1 AND user_id = $2",
      ["t1", "u1"]
    );
  });

  // TC03: Swagger 404 — task không tồn tại.
  it("TC03 - Task không tồn tại → 404", async () => {
    const req = { body: { taskId: "fake", userId: "u1", message: "Nhắc" } };
    const res = mockRes();
    mockValidationOk();
    db.query.mockResolvedValue({ rows: [] });
    await sendNotification(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC04: DB WHERE user_id=$2 → task thuộc user khác trả 404.
  it("TC04 - Task thuộc user khác → 404", async () => {
    const req = { body: { taskId: "t1", userId: "other-user", message: "Nhắc" } };
    const res = mockRes();
    mockValidationOk();
    db.query.mockResolvedValue({ rows: [] });
    await sendNotification(req, res);

    expect(db.query).toHaveBeenCalledWith(expect.any(String), ["t1", "other-user"]);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC05: Swagger 500 — lỗi server.
  it("TC05 - DB lỗi → 500 + failedPlatforms: ['all']", async () => {
    const req = { body: { taskId: "t1", userId: "u1", message: "Nhắc" } };
    const res = mockRes();
    mockValidationOk();
    db.query.mockRejectedValue(new Error("Connection refused"));
    await sendNotification(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].failedPlatforms).toEqual(["all"]);
  });

  // TC06 EXPECTED FAIL: Swagger summary = "Gửi thông báo nhắc nhở"
  //   → hàm phải thực sự gửi. Nhưng code chỉ check task rồi return 200.
  it("TC06 - Swagger nói 'gửi' nhưng không thực sự gửi ⚠️", async () => {
    const req = { body: { taskId: "t1", userId: "u1", message: "Nhắc" } };
    const res = mockRes();
    mockValidationOk();
    db.query.mockResolvedValue({ rows: [{ task_id: "t1" }] });
    await sendNotification(req, res);

    // Phải có ≥2 DB call (1 check task + 1 ghi log/gửi). Thực tế: 1.
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  // TC07 EXPECTED FAIL: Route yêu cầu message notEmpty() = required.
  //   Nhưng controller destructure { message } rồi không dùng ở đâu.
  it("TC07 - message required nhưng bị ignore ", async () => {
    const req = { body: { taskId: "t1", userId: "u1", message: "Nội dung quan trọng" } };
    const res = mockRes();
    mockValidationOk();
    db.query.mockResolvedValue({ rows: [{ task_id: "t1" }] });
    await sendNotification(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty("data.message", "Nội dung quan trọng");
  });
});
