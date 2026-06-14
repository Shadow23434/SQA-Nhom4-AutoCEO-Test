const mockListMeetingsDb = jest.fn();
const mockGetMeetingByIdDb = jest.fn();
const mockCreateMeetingDb = jest.fn();
const mockUpdateMeetingDb = jest.fn();
const mockDeleteMeetingDb = jest.fn();

jest.mock("../models/meetings.model.js", () => ({
  listMeetings: (...a) => mockListMeetingsDb(...a),
  getMeetingById: (...a) => mockGetMeetingByIdDb(...a),
  createMeeting: (...a) => mockCreateMeetingDb(...a),
  updateMeeting: (...a) => mockUpdateMeetingDb(...a),
  deleteMeeting: (...a) => mockDeleteMeetingDb(...a),
}));

const mockInvalidateDashboardCache = jest.fn();
jest.mock("../controllers/dashboard.controller.js", () => ({
  invalidateDashboardCache: (...a) => mockInvalidateDashboardCache(...a),
}));

jest.mock("axios");
jest.mock("@google/generative-ai");
jest.mock("openai", () => jest.fn().mockImplementation(() => ({})));
jest.mock("../utils/openaiHelper.js", () => ({
  askOpenAI: jest.fn(),
}));

import {
  listMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
} from "../controllers/meetings.controller.js";

// ===== HELPERS =====
const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

const SAMPLE_MEETING = {
  meeting_id: "m1",
  user_id: "u1",
  title: "Sprint Review",
  meeting_date: "2026-05-01",
  file_path: null,
  description: "Demo sprint 10",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

// ================================================================
describe("Meetings Controller — Unit Test CRUD", () => {
  beforeEach(() => jest.clearAllMocks());

  //  listMeetings (TC01 – TC04)
  describe("listMeetings", () => {
    // TC01: Route dùng verifyToken → req.user bắt buộc.
    it("TC01 - req.user undefined → 401 Unauthorized", async () => {
      const req = { user: undefined, query: {} };
      const res = mockRes();
      await listMeetings(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockListMeetingsDb).not.toHaveBeenCalled();
    });

    // TC02: DB schema — user_id VARCHAR(255) NOT NULL → falsy bị chặn.
    it("TC02 - req.user.id = '' (falsy) → 401", async () => {
      const req = { user: { id: "" }, query: {} };
      const res = mockRes();
      await listMeetings(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockListMeetingsDb).not.toHaveBeenCalled();
    });

    // TC03: GET / trả 200 với data[] + pagination.
    it("TC03 - Dữ liệu hợp lệ → 200 + data[] + pagination", async () => {
      const req = { user: { id: "u1" }, query: { page: 2, pageSize: 5, q: "sprint" } };
      const res = mockRes();
      mockListMeetingsDb.mockResolvedValue({
        rows: [SAMPLE_MEETING], total: 6, page: 2, pageSize: 5,
      });
      await listMeetings(req, res);

      expect(mockListMeetingsDb).toHaveBeenCalledWith("u1", { page: 2, pageSize: 5, q: "sprint" });
      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe("success");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toEqual({ page: 2, pageSize: 5, total: 6 });
    });

    // TC04: DB lỗi → 500.
    it("TC04 - DB lỗi → 500", async () => {
      const req = { user: { id: "u1" }, query: {} };
      const res = mockRes();
      mockListMeetingsDb.mockRejectedValue(new Error("DB connection lost"));
      await listMeetings(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  //  getMeetingById (TC05 – TC06)
  describe("getMeetingById", () => {
    // TC05: Meeting tồn tại → 200 + data.
    it("TC05 - Meeting tồn tại → 200 + data", async () => {
      const req = { params: { id: "m1" }, user: { id: "u1" } };
      const res = mockRes();
      mockGetMeetingByIdDb.mockResolvedValue(SAMPLE_MEETING);
      await getMeetingById(req, res);

      expect(mockGetMeetingByIdDb).toHaveBeenCalledWith("m1", "u1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.meeting_id).toBe("m1");
    });

    // TC06: Meeting không tồn tại → 404.
    it("TC06 - Meeting không tồn tại → 404", async () => {
      const req = { params: { id: "not-exist" }, user: { id: "u1" } };
      const res = mockRes();
      mockGetMeetingByIdDb.mockResolvedValue(null);
      await getMeetingById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  //  createMeeting (TC07 – TC11)
  describe("createMeeting", () => {
    // TC07: Tạo thành công → 201 + invalidate cache.
    it("TC07 - Tạo thành công → 201 + invalidate cache", async () => {
      const req = {
        user: { id: "u1" },
        body: { title: "Sprint Review", meeting_date: "2026-05-01", description: "Desc" },
      };
      const res = mockRes();
      mockCreateMeetingDb.mockResolvedValue(SAMPLE_MEETING);
      await createMeeting(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json.mock.calls[0][0].status).toBe("success");
      expect(mockInvalidateDashboardCache).toHaveBeenCalledWith("u1");
    });

    // TC08: DB schema cho phép NULL → body rỗng vẫn tạo được.
    it("TC08 - Body rỗng {} → fields = null, vẫn tạo", async () => {
      const req = { user: { id: "u1" }, body: {} };
      const res = mockRes();
      mockCreateMeetingDb.mockResolvedValue({ ...SAMPLE_MEETING, title: null });
      await createMeeting(req, res);

      expect(mockCreateMeetingDb).toHaveBeenCalledWith("u1", {
        title: null, meeting_date: null, file_path: null, description: null,
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    // TC09: DB lỗi → 500, không invalidate cache.
    it("TC09 - DB lỗi → 500", async () => {
      const req = { user: { id: "u1" }, body: { title: "X" } };
      const res = mockRes();
      mockCreateMeetingDb.mockRejectedValue(new Error("Duplicate key"));
      await createMeeting(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockInvalidateDashboardCache).not.toHaveBeenCalled();
    });

    // TC10 EXPECTED FAIL: RESTful — 201 PHẢI kèm resource.
    //   DB trả null → tạo thất bại → nên trả 500, không phải 201.
    it("TC10 - DB trả null → nên trả lỗi, thực tế trả 201 data:null ⚠️", async () => {
      const req = { user: { id: "u1" }, body: { title: "Test" } };
      const res = mockRes();
      mockCreateMeetingDb.mockResolvedValue(null);
      await createMeeting(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    // TC11 EXPECTED FAIL: Nhất quán — update/delete check null trước invalidate.
    //   createMeeting không check → cache bị invalidate dù tạo thất bại.
    it("TC11 - DB trả null → không nên invalidate cache ⚠️", async () => {
      const req = { user: { id: "u1" }, body: { title: "Test" } };
      const res = mockRes();
      mockCreateMeetingDb.mockResolvedValue(null);
      await createMeeting(req, res);
      expect(mockInvalidateDashboardCache).not.toHaveBeenCalled();
    });
  });

  //  updateMeeting (TC12 – TC13)
  describe("updateMeeting", () => {
    // TC12: Update thành công → 200 + invalidate cache.
    it("TC12 - Cập nhật thành công → 200 + invalidate cache", async () => {
      const req = { params: { id: "m1" }, user: { id: "u1" }, body: { title: "Updated" } };
      const res = mockRes();
      mockUpdateMeetingDb.mockResolvedValue({ ...SAMPLE_MEETING, title: "Updated" });
      await updateMeeting(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockInvalidateDashboardCache).toHaveBeenCalledWith("u1");
    });

    // TC13: Meeting không tồn tại → 404.
    it("TC13 - Meeting không tồn tại → 404", async () => {
      const req = { params: { id: "m1" }, user: { id: "u1" }, body: {} };
      const res = mockRes();
      mockUpdateMeetingDb.mockResolvedValue(null);
      await updateMeeting(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(mockInvalidateDashboardCache).not.toHaveBeenCalled();
    });
  });

  //  deleteMeeting (TC14 – TC16)
  describe("deleteMeeting", () => {
    // TC14: Xoá thành công → 200 + data đã xoá + invalidate cache.
    it("TC14 - Xoá thành công → 200 + data đã xoá", async () => {
      const req = { params: { id: "m1" }, user: { id: "u1" } };
      const res = mockRes();
      mockDeleteMeetingDb.mockResolvedValue(SAMPLE_MEETING);
      await deleteMeeting(req, res);

      expect(mockDeleteMeetingDb).toHaveBeenCalledWith("m1", "u1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockInvalidateDashboardCache).toHaveBeenCalledWith("u1");
    });

    // TC15: Meeting không tồn tại → 404.
    it("TC15 - Meeting không tồn tại → 404", async () => {
      const req = { params: { id: "not-exist" }, user: { id: "u1" } };
      const res = mockRes();
      mockDeleteMeetingDb.mockResolvedValue(null);
      await deleteMeeting(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(mockInvalidateDashboardCache).not.toHaveBeenCalled();
    });

    // TC16: DB lỗi → 500.
    it("TC16 - DB lỗi → 500", async () => {
      const req = { params: { id: "m1" }, user: { id: "u1" } };
      const res = mockRes();
      mockDeleteMeetingDb.mockRejectedValue(new Error("FK constraint"));
      await deleteMeeting(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
