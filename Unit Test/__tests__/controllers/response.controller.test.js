/**
 * Unit Tests: Response Controller
 * Module: response.controller.js
 * Framework: Jest / JavaScript (ESM)
 *
 * | Mã TC     | Phương thức           | Trường hợp test                              |
 * |-----------|-----------------------|----------------------------------------------|
 * | TC_RES_01 | getResponses          | Trả về danh sách response + phân trang      |
 * | TC_RES_02 | getResponses          | Lọc theo employeeId                          |
 * | TC_RES_03 | getResponses          | Lọc theo date                                |
 * | TC_RES_04 | getResponses          | Lỗi server → 500                             |
 * | TC_RES_05 | getResponsesByRequest | Trả về response của request hợp lệ          |
 * | TC_RES_06 | getResponsesByRequest | Request không tồn tại → 404                 |
 * | TC_RES_07 | getResponsesByRequest | Lỗi server → 500                             |
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── ESM Mock Setup ─────────────────────────────────────────────────────────
const mockQuery = jest.fn();

jest.unstable_mockModule('../config/db.js', () => ({
  default: { query: mockQuery }
}));

const { getResponses, getResponsesByRequest } = await import('../controllers/response.controller.js');

// ─── Helper ──────────────────────────────────────────────────────────────────
const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

// ═════════════════════════════════════════════════════════════════════════════
// getResponses
// ═════════════════════════════════════════════════════════════════════════════
describe('ResponseController – getResponses', () => {
  beforeEach(() => mockQuery.mockReset());

  it('TC_RES_01 – trả về danh sách response kèm phân trang mặc định', async () => {
    // Tương đương với Mã testcase: TC_RES_01 trong Excel - Lấy danh sách response thành công

    // Arrange
    const req = { user: { id: 'user-1' }, query: {} };
    const res = buildRes();
    const fakeRows = [{ id: 1, description: 'Đang xử lý', employee_name: 'Nguyễn A' }];
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: fakeRows });

    // Act
    await getResponses(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: fakeRows,
        pagination: expect.objectContaining({ total: 1, page: 1, limit: 10, totalPages: 1 })
      })
    );
  });

  it('TC_RES_02 – lọc theo employeeId', async () => {
    // Tương đương với Mã testcase: TC_RES_02 trong Excel - Lọc response theo employeeId

    // Arrange
    const req = { user: { id: 'user-1' }, query: { employeeId: 'emp-10' } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    // Act
    await getResponses(req, res);

    // Assert – SQL phải có điều kiện res.employee_id
    const [countSQL] = mockQuery.mock.calls[0];
    expect(countSQL).toContain('res.employee_id');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', data: [] }));
  });

  it('TC_RES_03 – lọc theo date', async () => {
    // Tương đương với Mã testcase: TC_RES_03 trong Excel - Lọc response theo ngày

    // Arrange
    const req = { user: { id: 'user-1' }, query: { date: '2025-05-01' } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });

    // Act
    await getResponses(req, res);

    // Assert
    const [countSQL] = mockQuery.mock.calls[0];
    expect(countSQL).toContain('DATE(res.created_at)');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ pagination: expect.objectContaining({ total: 3 }) })
    );
  });

  it('TC_RES_04 – lỗi server → 500', async () => {
    // Tương đương với Mã testcase: TC_RES_04 trong Excel - DB lỗi → 500

    // Arrange
    const req = { user: { id: 'user-1' }, query: {} };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('DB timeout'));

    // Act
    await getResponses(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal Server Error' }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getResponsesByRequest
// ═════════════════════════════════════════════════════════════════════════════
describe('ResponseController – getResponsesByRequest', () => {
  beforeEach(() => mockQuery.mockReset());

  it('TC_RES_05 – trả về responses của request hợp lệ', async () => {
    // Tương đương với Mã testcase: TC_RES_05 trong Excel - Lấy responses theo requestId thành công

    // Arrange
    const req = { params: { requestId: '55' }, user: { id: 'user-1' } };
    const res = buildRes();
    const fakeResp = [{ id: 1, description: 'Đã hoàn thành', employee_name: 'Lê B' }];
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 55 }] })  // ownership check
      .mockResolvedValueOnce({ rows: fakeResp });       // responses query

    // Act
    await getResponsesByRequest(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: fakeResp });
  });

  it('TC_RES_06 – request không thuộc user → 404', async () => {
    // Tương đương với Mã testcase: TC_RES_06 trong Excel - Request không tìm thấy → 404

    // Arrange
    const req = { params: { requestId: '999' }, user: { id: 'user-1' } };
    const res = buildRes();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Act
    await getResponsesByRequest(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Request not found' });
  });

  it('TC_RES_07 – lỗi server → 500', async () => {
    // Tương đương với Mã testcase: TC_RES_07 trong Excel - DB throw → 500

    // Arrange
    const req = { params: { requestId: '1' }, user: { id: 'user-1' } };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('Connection error'));

    // Act
    await getResponsesByRequest(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal Server Error' }));
  });
});
