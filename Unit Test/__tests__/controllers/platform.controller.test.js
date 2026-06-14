import {
  initiateOAuth,
  getConnectionStatus,
  unlinkPlatform,
  listConnections,
} from "../controllers/platform.controller.js";

// ===== MOCK DEPENDENCIES =====
const mockCreateOrUpdate = jest.fn();
const mockFindConnection = jest.fn();
const mockFindAllConnections = jest.fn();
const mockDeleteConnection = jest.fn();

jest.mock("../models/platform.model.js", () => ({
  createOrUpdatePlatformConnection: (...a) => mockCreateOrUpdate(...a),
  findPlatformConnection: (...a) => mockFindConnection(...a),
  findAllPlatformConnections: (...a) => mockFindAllConnections(...a),
  deletePlatformConnection: (...a) => mockDeleteConnection(...a),
}));

const mockGetClickUpAuthUrl = jest.fn();
jest.mock("../services/clickup.service.js", () => ({
  getClickUpAuthUrl: (...a) => mockGetClickUpAuthUrl(...a),
  exchangeCodeForToken: jest.fn(),
  getTeams: jest.fn(),
  fetchAndMapTasks: jest.fn(),
}));

jest.mock("../config/db.js", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

// ===== HELPERS =====
const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  r.redirect = jest.fn().mockReturnValue(r);
  return r;
};

describe("Platform Controller — Unit Test", () => {
  beforeEach(() => jest.clearAllMocks());

  //  initiateOAuth (TC01 – TC06)
  describe("initiateOAuth", () => {
    // TC01: Thiếu platform → 400.
    it("TC01 - Thiếu platform → 400", async () => {
      const req = { user: { id: "u1" }, body: { clientId: "c", clientSecret: "s" } };
      const res = mockRes();
      await initiateOAuth(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCreateOrUpdate).not.toHaveBeenCalled();
    });

    // TC02: Thiếu clientId/clientSecret → 400.
    it("TC02 - Thiếu clientId hoặc clientSecret → 400", async () => {
      const req = { user: { id: "u1" }, body: { platform: "clickup", clientId: "c" } };
      const res = mockRes();
      await initiateOAuth(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    // TC03: ClickUp hợp lệ → 200 + authUrl.
    it("TC03 - ClickUp hợp lệ → 200 + authUrl", async () => {
      const req = {
        user: { id: "u1" },
        body: { platform: "clickup", clientId: "cid", clientSecret: "csec" },
      };
      const res = mockRes();
      mockCreateOrUpdate.mockResolvedValue({});
      mockGetClickUpAuthUrl.mockReturnValue("https://app.clickup.com/api?client_id=cid");

      await initiateOAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe("success");
      expect(body.platform).toBe("clickup");
      expect(body.authUrl).toContain("https://app.clickup.com");
    });

    // TC04: Platform chưa hỗ trợ → 400.
    it("TC04 - Platform chưa hỗ trợ → 400", async () => {
      const req = {
        user: { id: "u1" },
        body: { platform: "jira", clientId: "c", clientSecret: "s" },
      };
      const res = mockRes();
      await initiateOAuth(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    // TC05: DB lỗi → 500.
    it("TC05 - DB lỗi → 500", async () => {
      const req = {
        user: { id: "u1" },
        body: { platform: "clickup", clientId: "c", clientSecret: "s" },
      };
      const res = mockRes();
      mockCreateOrUpdate.mockRejectedValue(new Error("DB write failed"));
      await initiateOAuth(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    // TC06 EXPECTED FAIL: DB schema access_token NOT NULL — phải là
    //   token thật. Nhưng code lưu "temp" → record giả nếu callback fail.
    it("TC06 - Lưu accessToken='temp' vi phạm logic nghiệp vụ ⚠️", async () => {
      const req = {
        user: { id: "u1" },
        body: { platform: "clickup", clientId: "c", clientSecret: "s" },
      };
      const res = mockRes();
      mockCreateOrUpdate.mockResolvedValue({});
      mockGetClickUpAuthUrl.mockReturnValue("https://clickup.com/auth");
      await initiateOAuth(req, res);

      const savedData = mockCreateOrUpdate.mock.calls[0][2];
      expect(savedData.accessToken).not.toBe("temp");
    });
  });

  //  getConnectionStatus (TC07 – TC11)
  describe("getConnectionStatus", () => {
    // TC07: Thiếu platform → 400.
    it("TC07 - Thiếu platform → 400", async () => {
      const req = { user: { id: "u1" }, query: {} };
      const res = mockRes();
      await getConnectionStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    // TC08: Chưa kết nối → connected: false.
    it("TC08 - Chưa kết nối → 200 + connected: false", async () => {
      const req = { user: { id: "u1" }, query: { platform: "clickup" } };
      const res = mockRes();
      mockFindConnection.mockResolvedValue(null);
      await getConnectionStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].connected).toBe(false);
    });

    // TC09: Đã kết nối → connected: true + workspace.
    it("TC09 - Đã kết nối → 200 + connected: true + workspace", async () => {
      const req = { user: { id: "u1" }, query: { platform: "clickup" } };
      const res = mockRes();
      mockFindConnection.mockResolvedValue({
        workspace_id: "ws1", workspace_name: "My Team", created_at: "2026-01-01",
      });
      await getConnectionStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.connected).toBe(true);
      expect(body.workspace).toEqual({ id: "ws1", name: "My Team" });
    });

    // TC10: DB lỗi → 500.
    it("TC10 - DB lỗi → 500", async () => {
      const req = { user: { id: "u1" }, query: { platform: "clickup" } };
      const res = mockRes();
      mockFindConnection.mockRejectedValue(new Error("timeout"));
      await getConnectionStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    // TC11 EXPECTED FAIL: JSDoc "Kiểm tra trạng thái kết nối" →
    //   connected phải phản ánh kết nối thật. Token "temp" = chưa kết nối.
    it("TC11 - token='temp' → nên connected:false ⚠️", async () => {
      const req = { user: { id: "u1" }, query: { platform: "clickup" } };
      const res = mockRes();
      mockFindConnection.mockResolvedValue({
        access_token: "temp", workspace_id: null, workspace_name: null, created_at: "2026-01-01",
      });
      await getConnectionStatus(req, res);

      expect(res.json.mock.calls[0][0].connected).toBe(false);
    });
  });

  //  unlinkPlatform (TC12 – TC15)
  describe("unlinkPlatform", () => {
    // TC12: Thiếu platform → 400.
    it("TC12 - Thiếu platform → 400", async () => {
      const req = { user: { id: "u1" }, body: {} };
      const res = mockRes();
      await unlinkPlatform(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    // TC13: Chưa kết nối → 404.
    it("TC13 - Chưa kết nối → 404", async () => {
      const req = { user: { id: "u1" }, body: { platform: "clickup" } };
      const res = mockRes();
      mockFindConnection.mockResolvedValue(null);
      await unlinkPlatform(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(mockDeleteConnection).not.toHaveBeenCalled();
    });

    // TC14: Hủy thành công → 200.
    it("TC14 - Hủy kết nối thành công → 200", async () => {
      const req = { user: { id: "u1" }, body: { platform: "clickup" } };
      const res = mockRes();
      mockFindConnection.mockResolvedValue({ id: "conn1" });
      mockDeleteConnection.mockResolvedValue(true);
      await unlinkPlatform(req, res);

      expect(mockDeleteConnection).toHaveBeenCalledWith("u1", "clickup");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    // TC15: DB lỗi → 500.
    it("TC15 - DB lỗi → 500", async () => {
      const req = { user: { id: "u1" }, body: { platform: "clickup" } };
      const res = mockRes();
      mockFindConnection.mockResolvedValue({ id: "conn1" });
      mockDeleteConnection.mockRejectedValue(new Error("FK constraint"));
      await unlinkPlatform(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  //  listConnections (TC16 – TC18)
  describe("listConnections", () => {
    // TC16: Chưa có connection → mảng rỗng.
    it("TC16 - Chưa kết nối → connections: []", async () => {
      const req = { user: { id: "u1" } };
      const res = mockRes();
      mockFindAllConnections.mockResolvedValue([]);
      await listConnections(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].connections).toEqual([]);
    });

    // TC17: Có connections → format đúng spec.
    it("TC17 - Có connections → map đúng format", async () => {
      const req = { user: { id: "u1" } };
      const res = mockRes();
      mockFindAllConnections.mockResolvedValue([
        { platform_type: "clickup", workspace_id: "ws1", workspace_name: "Team A", created_at: "2026-01-01" },
      ]);
      await listConnections(req, res);

      const conns = res.json.mock.calls[0][0].connections;
      expect(conns[0]).toEqual({
        platform: "clickup",
        workspace: { id: "ws1", name: "Team A" },
        connectedAt: "2026-01-01",
      });
    });

    // TC18: DB lỗi → 500.
    it("TC18 - DB lỗi → 500", async () => {
      const req = { user: { id: "u1" } };
      const res = mockRes();
      mockFindAllConnections.mockRejectedValue(new Error("Connection lost"));
      await listConnections(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
