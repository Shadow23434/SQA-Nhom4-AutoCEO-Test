import { jest } from '@jest/globals';

// --- MOCKING DEPENDENCIES ---

jest.unstable_mockModule("../../src/config/db.js", () => ({
  default: {
    query: jest.fn(),
  },
}));

jest.unstable_mockModule("../../src/models/user.model.js", () => ({
  findUserById: jest.fn(),
}));

// --- IMPORTING CONTROLLER & MOCKED MODULES ---
const { 
  getDashboardStats, invalidateDashboardCache 
} = await import("../../src/controllers/dashboard.controller.js");
const pool = (await import("../../src/config/db.js")).default;
const { findUserById } = await import("../../src/models/user.model.js");

describe("Controller - DashboardController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    // Mock console
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Xóa cache trước mỗi test để đảm bảo tính độc lập
    invalidateDashboardCache("user123");
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  /**
   * UNIT-CTRL-DASH-001: getDashboardStats
   * Nghiệp vụ: Lấy thông số thống kê tổng hợp cho Dashboard (Email, Task, Report, Meeting).
   */
  describe("getDashboardStats", () => {
    it("TC_M3_001 - nên trả về 401 nếu chưa đăng nhập", async () => {
      req.user = null;
      await getDashboardStats(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it("TC_M3_002 - nên lấy dữ liệu từ cache nếu còn hạn", async () => {
      req.user = { id: "user123" };
      
      // Lần 1: Chạy thật để set cache
      findUserById.mockResolvedValue({ id: "user123", name: "User" });
      pool.query.mockResolvedValue({ rows: [{ count: "5" }] });
      await getDashboardStats(req, res);
      
      // Lần 2: Lấy từ cache
      jest.clearAllMocks();
      await getDashboardStats(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        status: "success",
        cached: true,
        data: expect.any(Object)
      }));
      expect(findUserById).not.toHaveBeenCalled();
    });

    it("TC_M3_003 - nên trả về 404 nếu không thấy user", async () => {
      req.user = { id: "user123" };
      findUserById.mockResolvedValue(null);
      await getDashboardStats(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it("TC_M3_004 - nên trả về 503 nếu lỗi timeout database và không có cache", async () => {
      req.user = { id: "user123" };
      // Giả lập timeout bằng promise không bao giờ resolve
      findUserById.mockImplementation(() => new Promise(() => {}));
      
      // Dùng fake timers để kích hoạt timeout nhanh hơn trong test
      jest.useFakeTimers();
      const promise = getDashboardStats(req, res);
      jest.advanceTimersByTime(6000);
      await promise;
      
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
      jest.useRealTimers();
    });

    it("TC_M3_005 - nên trả về stale data nếu lỗi database nhưng có cache", async () => {
      jest.useFakeTimers();
      req.user = { id: "user123" };
      
      // 1. Tạo cache
      findUserById.mockResolvedValue({ id: "user123" });
      pool.query.mockResolvedValue({ rows: [{ count: "10" }] });
      await getDashboardStats(req, res);
      
      // 2. Làm cache quá hạn (hơn 5 phút)
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      // 3. Mock DB Error cho lần gọi tiếp theo
      findUserById.mockRejectedValue(new Error("Database timeout"));
      
      await getDashboardStats(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        cached: true, 
        stale: true,
        data: expect.objectContaining({ unreadEmails: 10 }) 
      }));
      jest.useRealTimers();
    });

    it("TC_M3_006 - nên lấy thống kê thành công và định dạng đúng", async () => {
      req.user = { id: "user123" };
      findUserById.mockResolvedValue({ id: "user123", gmail: "u@g.c", name: "Name" });
      
      // Mock cho các query count
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: "5" }] }) // unreadEmails
        .mockResolvedValueOnce({ rows: [{ count: "3" }] }) // pendingTasks
        .mockResolvedValueOnce({ rows: [{ count: "2" }] }) // todayDataReports
        .mockResolvedValueOnce({ rows: [{ count: "10" }] }) // dataReports
        .mockResolvedValueOnce({ rows: [{ count: "1" }] }) // upcomingMeetings
        .mockResolvedValueOnce({ rows: [
          { filename: "file1.xlsx", created_at: new Date(), status: "done" }
        ] }); // recentActivity

      await getDashboardStats(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        data: expect.objectContaining({
          unreadEmails: 5,
          pendingTasks: 3,
          dataReports: 10,
          todayDataReports: 2,
          upcomingMeetings: 1,
          recentActivity: expect.arrayContaining([
            expect.objectContaining({ action: expect.stringContaining("file1.xlsx"), status: "done" })
          ])
        })
      }));
    });

    it("TC_M3_007 - nên trả về 500 nếu có lỗi bất ngờ khác", async () => {
      req.user = { id: "user123" };
      findUserById.mockResolvedValue({ id: "user123" });
      pool.query.mockRejectedValue(new Error("Unexpected error"));
      
      await getDashboardStats(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });
  });

  /**
   * UNIT-CTRL-DASH-002: invalidateDashboardCache
   * Nghiệp vụ: Xóa cache khi dữ liệu liên quan thay đổi.
   */
  describe("invalidateDashboardCache", () => {
    it("TC_M3_008 - nên xóa cache thành công", async () => {
      const userId = "user123";
      // Đổ data vào cache trước
      findUserById.mockResolvedValue({ id: userId });
      pool.query.mockResolvedValue({ rows: [{ count: "0" }] });
      req.user = { id: userId };
      await getDashboardStats(req, res);
      
      // Xóa cache
      invalidateDashboardCache(userId);
      
      // Kiểm tra lần gọi tiếp theo không được dùng cache
      jest.clearAllMocks();
      await getDashboardStats(req, res);
      const response = res.json.mock.calls[0][0];
      expect(response.cached).toBe(false);
    });
  });
});
