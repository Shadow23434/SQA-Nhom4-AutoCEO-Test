/**
 * Unit Tests: Request Controller
 * Module: request.controller.js
 * Framework: Jest / JavaScript (ESM)
 *
 * | Mã TC    | Phương thức    | Trường hợp test                             |
 * |----------|----------------|---------------------------------------------|
 * | TC_REQ_01| getRequests    | Trả về danh sách request + phân trang       |
 * | TC_REQ_02| getRequests    | Lọc theo employeeId                         |
 * | TC_REQ_03| getRequests    | Lọc theo date                               |
 * | TC_REQ_04| getRequests    | Lỗi server → 500                            |
 * | TC_REQ_05| getRequestById | Trả về request theo ID hợp lệ              |
 * | TC_REQ_06| getRequestById | Request không tồn tại → 404                |
 * | TC_REQ_07| getRequestById | Lỗi server → 500                            |
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── ESM Mock Setup ────────────────────────────────────────────────────────
const mockQuery = jest.fn();

jest.unstable_mockModule('../config/db.js', () => ({
  default: { query: mockQuery }
}));

// Import AFTER mock registration
const { getRequests, getRequestById } = await import('../controllers/request.controller.js');

// ─── Helper ─────────────────────────────────────────────────────────────────
const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

// ═════════════════════════════════════════════════════════════════════════════
// getRequests
// ═════════════════════════════════════════════════════════════════════════════
describe('RequestController – getRequests', () => {
  beforeEach(() => mockQuery.mockReset());

  it('TC_REQ_01 – trả về danh sách request kèm phân trang mặc định', async () => {
    // Tương đương với Mã testcase: TC_REQ_01 trong Excel - Lấy danh sách request thành công

    // Arrange
    const req = { user: { id: 'user-1' }, query: {} };
    const res = buildRes();
    const fakeRows = [{ id: 1, description: 'Nhắc nhở task A' }];
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: fakeRows });

    // Act
    await getRequests(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: fakeRows,
        pagination: expect.objectContaining({ total: 1, page: 1, limit: 10, totalPages: 1 })
      })
    );
  });

  it('TC_REQ_02 – lọc theo employeeId', async () => {
    // Tương đương với Mã testcase: TC_REQ_02 trong Excel - Lọc request theo employeeId

    // Arrange
    const req = { user: { id: 'user-1' }, query: { employeeId: 'emp-42' } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    // Act
    await getRequests(req, res);

    // Assert – SQL phải chứa điều kiện e.id
    const [countSQL] = mockQuery.mock.calls[0];
    expect(countSQL).toContain('e.id');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', data: [] }));
  });

  it('TC_REQ_03 – lọc theo date', async () => {
    // Tương đương với Mã testcase: TC_REQ_03 trong Excel - Lọc request theo ngày

    // Arrange
    const req = { user: { id: 'user-1' }, query: { date: '2025-01-01' } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ id: 10 }, { id: 11 }] });

    // Act
    await getRequests(req, res);

    // Assert
    const [countSQL] = mockQuery.mock.calls[0];
    expect(countSQL).toContain('DATE(r.created_at)');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ pagination: expect.objectContaining({ total: 2 }) })
    );
  });

  it('TC_REQ_04 – lỗi server → 500', async () => {
    // Tương đương với Mã testcase: TC_REQ_04 trong Excel - DB lỗi → 500

    // Arrange
    const req = { user: { id: 'user-1' }, query: {} };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('DB down'));

    // Act
    await getRequests(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal Server Error' }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getRequestById
// ═════════════════════════════════════════════════════════════════════════════
describe('RequestController – getRequestById', () => {
  beforeEach(() => mockQuery.mockReset());

  it('TC_REQ_05 – trả về request theo ID hợp lệ', async () => {
    // Tương đương với Mã testcase: TC_REQ_05 trong Excel - Lấy 1 request thành công

    // Arrange
    const req = { params: { id: '99' }, user: { id: 'user-1' } };
    const res = buildRes();
    const fakeRow = { id: 99, description: 'Nhắc task X', user_id: 'user-1' };
    mockQuery.mockResolvedValueOnce({ rows: [fakeRow] });

    // Act
    await getRequestById(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: fakeRow });
  });

  it('TC_REQ_06 – request không tồn tại → 404', async () => {
    // Tương đương với Mã testcase: TC_REQ_06 trong Excel - Request không tìm thấy → 404

    // Arrange
    const req = { params: { id: '999' }, user: { id: 'user-1' } };
    const res = buildRes();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Act
    await getRequestById(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Request not found' });
  });

  it('TC_REQ_07 – lỗi server → 500', async () => {
    // Tương đương với Mã testcase: TC_REQ_07 trong Excel - DB throw → 500

    // Arrange
    const req = { params: { id: '1' }, user: { id: 'user-1' } };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    // Act
    await getRequestById(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal Server Error' }));
  });
});
