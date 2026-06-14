/**
 * Unit Tests: Task Controller
 * Module: task.controller.js
 * Framework: Jest / JavaScript (ESM)
 *
 * | Mã TC      | Phương thức   | Trường hợp test                                     |
 * |------------|---------------|-----------------------------------------------------|
 * | TC_TASK_01 | getTasks      | Trả về danh sách task + phân trang mặc định         |
 * | TC_TASK_02 | getTasks      | Lọc theo priority                                   |
 * | TC_TASK_03 | getTasks      | Lọc theo assignee                                   |
 * | TC_TASK_04 | getTasks      | Lọc theo date                                       |
 * | TC_TASK_05 | getTasks      | Validation error → 400                              |
 * | TC_TASK_06 | getTasks      | Lỗi server → 500                                    |
 * | TC_TASK_07 | completeTask  | Cập nhật trạng thái task thành công                 |
 * | TC_TASK_08 | completeTask  | Task không tồn tại → 400                           |
 * | TC_TASK_09 | completeTask  | Không có quyền → 403                               |
 * | TC_TASK_10 | completeTask  | Validation error → 400                              |
 * | TC_TASK_11 | completeTask  | Lỗi server → 500                                    |
 * | TC_TASK_12 | updateTask    | Cập nhật task thành công                            |
 * | TC_TASK_13 | updateTask    | Task không tồn tại → 404                           |
 * | TC_TASK_14 | updateTask    | Không có quyền → 403                               |
 * | TC_TASK_15 | updateTask    | Validation error → 400                              |
 * | TC_TASK_16 | updateTask    | Lỗi server → 500                                    |
 * | TC_TASK_17 | sendReminders | taskIds rỗng → 400                                 |
 * | TC_TASK_18 | sendReminders | taskIds không phải array → 400                     |
 * | TC_TASK_19 | sendReminders | Gửi Telegram thành công                            |
 * | TC_TASK_20 | sendReminders | Gửi Zalo thành công                               |
 * | TC_TASK_21 | sendReminders | Task không có uid_platform → skipped               |
 * | TC_TASK_22 | sendReminders | Telegram thiếu token → failed                      |
 * | TC_TASK_23 | sendReminders | Zalo thiếu token → failed                          |
 * | TC_TASK_24 | sendReminders | Platform không xác định → skipped                  |
 * | TC_TASK_25 | sendReminders | Axios throw → failed (per-task)                    |
 * | TC_TASK_26 | sendReminders | DB throw ngoài vòng lặp → 500                     |
 * | TC_TASK_27 | sendReminders | User chưa có bot_config → token undefined → failed |
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── ESM Mock Setup ──────────────────────────────────────────────────────────
const mockQuery = jest.fn();
const mockInvalidateCache = jest.fn();
const mockAxiosPost = jest.fn();
const mockValidationResult = jest.fn();

jest.unstable_mockModule('../config/db.js', () => ({
  default: { query: mockQuery }
}));

jest.unstable_mockModule('../controllers/dashboard.controller.js', () => ({
  invalidateDashboardCache: mockInvalidateCache
}));

jest.unstable_mockModule('axios', () => ({
  default: { post: mockAxiosPost }
}));

jest.unstable_mockModule('express-validator', () => ({
  validationResult: mockValidationResult
}));

const { getTasks, completeTask, updateTask, sendReminders } = await import('../controllers/task.controller.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};
const noErrors  = () => mockValidationResult.mockReturnValue({ isEmpty: () => true });
const hasErrors = () => mockValidationResult.mockReturnValue({
  isEmpty: () => false,
  array: () => [{ msg: 'Invalid' }]
});

// ═════════════════════════════════════════════════════════════════════════════
// getTasks
// ═════════════════════════════════════════════════════════════════════════════
describe('TaskController – getTasks', () => {
  beforeEach(() => { mockQuery.mockReset(); mockValidationResult.mockReset(); });

  it('TC_TASK_01 – trả về danh sách task + phân trang mặc định', async () => {
    // Tương đương với Mã testcase: TC_TASK_01 trong Excel - Lấy task thành công không filter
    // Arrange
    noErrors();
    const req = { query: { userId: 'u1' } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ task_id: 1, description: 'Task A', priority: null, assignee: null, created_at: new Date(), updated_at: new Date() }] });

    // Act
    await getTasks(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      tasks: [expect.objectContaining({ priority: 'medium', assignee: 'Unassigned' })],
      pagination: expect.objectContaining({ total: 1, page: 1, limit: 10 })
    }));
  });

  it('TC_TASK_02 – lọc theo priority', async () => {
    // Tương đương với Mã testcase: TC_TASK_02 trong Excel - Lọc task theo priority
    // Arrange
    noErrors();
    const req = { query: { userId: 'u1', priority: 'high' } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    // Act
    await getTasks(req, res);

    // Assert
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('priority');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('TC_TASK_03 – lọc theo assignee', async () => {
    // Tương đương với Mã testcase: TC_TASK_03 trong Excel - Lọc task theo assignee
    // Arrange
    noErrors();
    const req = { query: { userId: 'u1', assignee: 'emp-5' } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    // Act
    await getTasks(req, res);

    // Assert
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('assignee');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('TC_TASK_04 – lọc theo date', async () => {
    // Tương đương với Mã testcase: TC_TASK_04 trong Excel - Lọc task theo ngày
    // Arrange
    noErrors();
    const req = { query: { userId: 'u1', date: '2025-01-01' } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    // Act
    await getTasks(req, res);

    // Assert
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('DATE(created_at)');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('TC_TASK_05 – validation error → 400', async () => {
    // Tương đương với Mã testcase: TC_TASK_05 trong Excel - Input không hợp lệ → 400
    // Arrange
    hasErrors();
    const req = { query: {} };
    const res = buildRes();

    // Act
    await getTasks(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors: expect.any(Array) }));
  });

  it('TC_TASK_06 – lỗi server → 500', async () => {
    // Tương đương với Mã testcase: TC_TASK_06 trong Excel - DB throw → 500
    // Arrange
    noErrors();
    const req = { query: { userId: 'u1' } };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('DB down'));

    // Act
    await getTasks(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// completeTask
// ═════════════════════════════════════════════════════════════════════════════
describe('TaskController – completeTask', () => {
  beforeEach(() => { mockQuery.mockReset(); mockValidationResult.mockReset(); mockInvalidateCache.mockReset(); });

  it('TC_TASK_07 – cập nhật task thành công', async () => {
    // Tương đương với Mã testcase: TC_TASK_07 trong Excel - completeTask thành công
    // Arrange
    noErrors();
    const req = { body: { userId: 'u1', taskId: 't1', status: 'done' } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't1', user_id: 'u1' }] })
      .mockResolvedValueOnce({ rows: [{ task_id: 't1', status: 'done' }] });

    // Act
    await completeTask(req, res);

    // Assert
    expect(mockInvalidateCache).toHaveBeenCalledWith('u1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Task updated successfully' }));
  });

  it('TC_TASK_08 – task không tồn tại → 400', async () => {
    // Tương đương với Mã testcase: TC_TASK_08 trong Excel - Task không tồn tại
    // Arrange
    noErrors();
    const req = { body: { userId: 'u1', taskId: 'bad', status: 'done' } };
    const res = buildRes();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Act
    await completeTask(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Task không tồn tại' });
  });

  it('TC_TASK_09 – không có quyền → 403', async () => {
    // Tương đương với Mã testcase: TC_TASK_09 trong Excel - User không có quyền → 403
    // Arrange
    noErrors();
    const req = { body: { userId: 'u1', taskId: 't1', status: 'done' } };
    const res = buildRes();
    mockQuery.mockResolvedValueOnce({ rows: [{ task_id: 't1', user_id: 'other-user' }] });

    // Act
    await completeTask(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Bạn không có quyền cập nhật task này' });
  });

  it('TC_TASK_10 – validation error → 400', async () => {
    // Tương đương với Mã testcase: TC_TASK_10 trong Excel - Validation lỗi → 400
    // Arrange
    hasErrors();
    const req = { body: {} };
    const res = buildRes();

    // Act
    await completeTask(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('TC_TASK_11 – lỗi server → 500', async () => {
    // Tương đương với Mã testcase: TC_TASK_11 trong Excel - DB throw → 500
    // Arrange
    noErrors();
    const req = { body: { userId: 'u1', taskId: 't1', status: 'done' } };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    // Act
    await completeTask(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// updateTask
// ═════════════════════════════════════════════════════════════════════════════
describe('TaskController – updateTask', () => {
  beforeEach(() => { mockQuery.mockReset(); mockValidationResult.mockReset(); });

  it('TC_TASK_12 – cập nhật task thành công', async () => {
    // Tương đương với Mã testcase: TC_TASK_12 trong Excel - updateTask thành công
    // Arrange
    noErrors();
    const req = { body: { userId: 'u1', taskId: 't1', description: 'Mô tả mới', priority: 'high', assignee: 'emp-1' } };
    const res = buildRes();
    const updatedRow = { task_id: 't1', description: 'Mô tả mới', priority: 'high' };
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't1', user_id: 'u1' }] })
      .mockResolvedValueOnce({ rows: [updatedRow] });

    // Act
    await updateTask(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      message: 'Task updated successfully',
      task: updatedRow
    }));
  });

  it('TC_TASK_13 – task không tồn tại → 404', async () => {
    // Tương đương với Mã testcase: TC_TASK_13 trong Excel - Task không tồn tại → 404
    // Arrange
    noErrors();
    const req = { body: { userId: 'u1', taskId: 'ghost', description: 'x' } };
    const res = buildRes();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Act
    await updateTask(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Task not found' });
  });

  it('TC_TASK_14 – không có quyền → 403', async () => {
    // Tương đương với Mã testcase: TC_TASK_14 trong Excel - User không có quyền → 403
    // Arrange
    noErrors();
    const req = { body: { userId: 'u1', taskId: 't1' } };
    const res = buildRes();
    mockQuery.mockResolvedValueOnce({ rows: [{ task_id: 't1', user_id: 'u2' }] });

    // Act
    await updateTask(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('TC_TASK_15 – validation error → 400', async () => {
    // Tương đương với Mã testcase: TC_TASK_15 trong Excel - Validation lỗi → 400
    // Arrange
    hasErrors();
    const req = { body: {} };
    const res = buildRes();

    // Act
    await updateTask(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('TC_TASK_16 – lỗi server → 500', async () => {
    // Tương đương với Mã testcase: TC_TASK_16 trong Excel - DB throw → 500
    // Arrange
    noErrors();
    const req = { body: { userId: 'u1', taskId: 't1' } };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('Error'));

    // Act
    await updateTask(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// sendReminders
// ═════════════════════════════════════════════════════════════════════════════
describe('TaskController – sendReminders', () => {
  beforeEach(() => { mockQuery.mockReset(); mockAxiosPost.mockReset(); });

  it('TC_TASK_17 – taskIds rỗng → 400', async () => {
    // Tương đương với Mã testcase: TC_TASK_17 trong Excel - taskIds rỗng → 400
    // Arrange
    const req = { body: { userId: 'u1', taskIds: [] } };
    const res = buildRes();

    // Act
    await sendReminders(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'No tasks selected' }));
  });

  it('TC_TASK_18 – taskIds không phải array → 400', async () => {
    // Tương đương với Mã testcase: TC_TASK_18 trong Excel - taskIds không hợp lệ → 400
    // Arrange
    const req = { body: { userId: 'u1', taskIds: 'not-array' } };
    const res = buildRes();

    // Act
    await sendReminders(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'No tasks selected' }));
  });

  it('TC_TASK_19 – gửi Telegram thành công', async () => {
    // Tương đương với Mã testcase: TC_TASK_19 trong Excel - Gửi reminder Telegram
    // Arrange
    const req = { body: { userId: 'u1', taskIds: ['t1'] } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't1', description: 'Task A', assignee: 'emp-1', platform: 1, uid_platform: 'chat123' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: { telegram: { bot_token: 'TOKEN' } } }] })
      .mockResolvedValueOnce({ rows: [{ id: 'req-1' }] })
      .mockResolvedValueOnce({ rows: [] });
    mockAxiosPost.mockResolvedValueOnce({ data: { ok: true } });

    // Act
    await sendReminders(req, res);

    // Assert
    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ chat_id: 'chat123' })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      results: expect.arrayContaining([expect.objectContaining({ status: 'sent', platform: 'telegram' })])
    }));
  });

  it('TC_TASK_20 – gửi Zalo thành công', async () => {
    // Tương đương với Mã testcase: TC_TASK_20 trong Excel - Gửi reminder Zalo
    // Arrange
    const req = { body: { userId: 'u1', taskIds: ['t2'] } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't2', description: 'Task B', assignee: 'emp-2', platform: 2, uid_platform: 'zalo-uid' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: { zalo: { bot_token: 'ZTOKEN' } } }] })
      .mockResolvedValueOnce({ rows: [{ id: 'req-2' }] })
      .mockResolvedValueOnce({ rows: [] });
    mockAxiosPost.mockResolvedValueOnce({ data: {} });

    // Act
    await sendReminders(req, res);

    // Assert
    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('zapps.me'),
      expect.objectContaining({ chat_id: 'zalo-uid' }),
      expect.any(Object)
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      results: expect.arrayContaining([expect.objectContaining({ status: 'sent', platform: 'zalo' })])
    }));
  });

  it('TC_TASK_21 – task không có uid_platform → skipped', async () => {
    // Tương đương với Mã testcase: TC_TASK_21 trong Excel - No employee → skipped
    // Arrange
    const req = { body: { userId: 'u1', taskIds: ['t3'] } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't3', description: 'Task C', assignee: 'emp-3', platform: 1, uid_platform: null }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: {} }] });

    // Act
    await sendReminders(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      results: expect.arrayContaining([expect.objectContaining({ status: 'skipped' })])
    }));
  });

  it('TC_TASK_22 – Telegram thiếu token → failed', async () => {
    // Tương đương với Mã testcase: TC_TASK_22 trong Excel - Missing Telegram token
    // Arrange
    const req = { body: { userId: 'u1', taskIds: ['t4'] } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't4', description: 'Task D', assignee: 'emp-4', platform: 1, uid_platform: 'chat999' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: { telegram: {} } }] });

    // Act
    await sendReminders(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      results: expect.arrayContaining([expect.objectContaining({ status: 'failed', reason: 'Missing Telegram Token in Bot Config' })])
    }));
  });

  it('TC_TASK_23 – Zalo thiếu token → failed', async () => {
    // Tương đương với Mã testcase: TC_TASK_23 trong Excel - Missing Zalo token
    // Arrange
    const req = { body: { userId: 'u1', taskIds: ['t5'] } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't5', description: 'Task E', assignee: 'emp-5', platform: 2, uid_platform: 'zalo-x' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: { zalo: {} } }] });

    // Act
    await sendReminders(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      results: expect.arrayContaining([expect.objectContaining({ status: 'failed', reason: 'Missing Zalo Token in Bot Config' })])
    }));
  });

  it('TC_TASK_24 – platform không xác định → skipped', async () => {
    // Tương đương với Mã testcase: TC_TASK_24 trong Excel - Unknown platform → skipped
    // Arrange
    const req = { body: { userId: 'u1', taskIds: ['t6'] } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't6', description: 'Task F', assignee: 'emp-6', platform: 99, uid_platform: 'uid-x' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: {} }] });

    // Act
    await sendReminders(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      results: expect.arrayContaining([expect.objectContaining({ status: 'skipped', reason: 'Unknown platform' })])
    }));
  });

  it('TC_TASK_25 – axios throw → failed (per-task catch)', async () => {
    // Tương đương với Mã testcase: TC_TASK_25 trong Excel - Axios network error → task failed
    // Arrange
    const req = { body: { userId: 'u1', taskIds: ['t7'] } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't7', description: 'Task G', assignee: 'emp-7', platform: 1, uid_platform: 'chat-x' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: { telegram: { bot_token: 'TOKEN' } } }] });
    mockAxiosPost.mockRejectedValueOnce(new Error('Network Error'));

    // Act
    await sendReminders(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      results: expect.arrayContaining([expect.objectContaining({ status: 'failed' })])
    }));
  });

  it('TC_TASK_26 – DB throw ngoài vòng lặp → 500', async () => {
    // Arrange
    const req = { body: { userId: 'u1', taskIds: ['t8'] } };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('DB fatal'));

    // Act
    await sendReminders(req, res);

    // Assert – Lỗi hạ tầng DB xảy ra trước khi xử lý task
    // HTTP 500. Hệ thống báo lỗi nội bộ, không gửi được nhắc nhở.
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });

  it('TC_TASK_27 – user chưa cấu hình bot (bot_config rỗng) → failed vì thiếu token', async () => {
    // Arrange – User tồn tại trong hệ thống nhưng chưa lưu bất kỳ cấu hình bot nào.
    // bot_config query trả về rows rỗng → platformConfigs fallback về {} → không có token nào.
    const req = { body: { userId: 'u1', taskIds: ['t9'] } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ task_id: 't9', description: 'Task H', assignee: 'emp-9', platform: 1, uid_platform: 'chat-abc' }] })
      .mockResolvedValueOnce({ rows: [] }); // bot_config chưa có row nào

    // Act
    await sendReminders(req, res);

    // Assert – Không có token Telegram → hệ thống không gửi được tin nhắn cho nhân viên.
    // HTTP 200. Mảng results chứa 1 phần tử với status='failed' và reason chỉ rõ thiếu Telegram Token.
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      results: expect.arrayContaining([
        expect.objectContaining({ status: 'failed', reason: 'Missing Telegram Token in Bot Config' })
      ])
    }));
  });
});
