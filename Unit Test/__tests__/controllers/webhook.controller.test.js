/**
 * Unit Tests: Webhook Controller
 * Module: webhook.controller.js
 * Framework: Jest / JavaScript (ESM)
 *
 * | Mã TC    | Phương thức           | Trường hợp test                                     |
 * |----------|-----------------------|-----------------------------------------------------|
 * | TC_WH_01 | handleTelegramWebhook | Không có message → 200 OK bỏ qua                  |
 * | TC_WH_02 | handleTelegramWebhook | message không có text → 200 OK bỏ qua             |
 * | TC_WH_03 | handleTelegramWebhook | Employee không tồn tại → 200 OK bỏ qua            |
 * | TC_WH_04 | handleTelegramWebhook | Lưu response thành công (có tracking)              |
 * | TC_WH_05 | handleTelegramWebhook | Lưu response thành công (không có tracking)        |
 * | TC_WH_06 | handleTelegramWebhook | Lỗi server → 500                                   |
 * | TC_WH_07 | handleZaloWebhook     | Event không phải text → 200 Ignored                |
 * | TC_WH_08 | handleZaloWebhook     | Employee không tồn tại → 200 Unknown employee      |
 * | TC_WH_09 | handleZaloWebhook     | Secret token không hợp lệ → 403                   |
 * | TC_WH_10 | handleZaloWebhook     | Lưu response Zalo thành công (có tracking)        |
 * | TC_WH_11 | handleZaloWebhook     | Lưu response Zalo (không có tracking)             |
 * | TC_WH_12 | handleZaloWebhook     | Lỗi server → 500                                   |
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── ESM Mock Setup ──────────────────────────────────────────────────────────
const mockQuery = jest.fn();
const mockAddZaloMessageToCache = jest.fn();

jest.unstable_mockModule('../config/db.js', () => ({
  default: { query: mockQuery }
}));

jest.unstable_mockModule('../controllers/botConfig.controller.js', () => ({
  addZaloMessageToCache: mockAddZaloMessageToCache
}));

const { handleTelegramWebhook, handleZaloWebhook } = await import('../controllers/webhook.controller.js');

// ─── Helper ──────────────────────────────────────────────────────────────────
const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  res.send   = jest.fn().mockReturnValue(res);
  return res;
};

// ═════════════════════════════════════════════════════════════════════════════
// handleTelegramWebhook
// ═════════════════════════════════════════════════════════════════════════════
describe('WebhookController – handleTelegramWebhook', () => {
  beforeEach(() => mockQuery.mockReset());

  it('TC_WH_01 – không có message → 200 OK bỏ qua', async () => {
    // Tương đương với Mã testcase: TC_WH_01 trong Excel - Body không có message
    // Arrange
    const req = { body: {} };
    const res = buildRes();

    // Act
    await handleTelegramWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('TC_WH_02 – message không có text → 200 OK bỏ qua', async () => {
    // Tương đương với Mã testcase: TC_WH_02 trong Excel - message không có text
    // Arrange
    const req = { body: { message: { chat: { id: 1 }, message_id: 1 } } };
    const res = buildRes();

    // Act
    await handleTelegramWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
  });

  it('TC_WH_03 – employee không tồn tại → 200 OK bỏ qua', async () => {
    // Tương đương với Mã testcase: TC_WH_03 trong Excel - chat_id không khớp employee nào
    // Arrange
    const req = { body: { message: { chat: { id: 999 }, text: 'Hello', message_id: 1 } } };
    const res = buildRes();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Act
    await handleTelegramWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
  });

  it('TC_WH_04 – lưu response thành công (có request tracking)', async () => {
    // Tương đương với Mã testcase: TC_WH_04 trong Excel - Telegram lưu response thành công
    // Arrange
    const req = { body: { message: { chat: { id: 100 }, text: 'Đã xong', message_id: 55 } } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'emp-1', user_id: 'u1' }] })  // employee
      .mockResolvedValueOnce({ rows: [{ request_id: 'req-1' }] })          // tracking
      .mockResolvedValueOnce({ rows: [] });                                  // INSERT response

    // Act
    await handleTelegramWebhook(req, res);

    // Assert – INSERT phải được gọi với request_id = 'req-1'
    const insertArgs = mockQuery.mock.calls[2][1];
    expect(insertArgs).toContain('req-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
  });

  it('TC_WH_05 – lưu response thành công (không có tracking → requestId = null)', async () => {
    // Tương đương với Mã testcase: TC_WH_05 trong Excel - Không có tracking → requestId null
    // Arrange
    const req = { body: { message: { chat: { id: 200 }, text: 'OK', message_id: 66 } } };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'emp-2', user_id: 'u2' }] })
      .mockResolvedValueOnce({ rows: [] })   // tracking empty
      .mockResolvedValueOnce({ rows: [] });   // INSERT response

    // Act
    await handleTelegramWebhook(req, res);

    // Assert – requestId = null (first param of INSERT)
    const insertArgs = mockQuery.mock.calls[2][1];
    expect(insertArgs[0]).toBeNull();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('TC_WH_06 – lỗi server → 500', async () => {
    // Tương đương với Mã testcase: TC_WH_06 trong Excel - DB throw → 500
    // Arrange
    const req = { body: { message: { chat: { id: 1 }, text: 'x', message_id: 1 } } };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    // Act
    await handleTelegramWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Internal Server Error');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// handleZaloWebhook
// ═════════════════════════════════════════════════════════════════════════════
describe('WebhookController – handleZaloWebhook', () => {
  beforeEach(() => { mockQuery.mockReset(); mockAddZaloMessageToCache.mockReset(); });

  it('TC_WH_07 – event không phải text → 200 Ignored', async () => {
    // Tương đương với Mã testcase: TC_WH_07 trong Excel - Event khác loại text → Ignored
    // Arrange
    const req = { body: { event_name: 'user.joined', message: {}, sender: {} }, headers: {} };
    const res = buildRes();

    // Act
    await handleZaloWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ignored event' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('TC_WH_08 – employee không tồn tại → 200 Unknown employee', async () => {
    // Tương đương với Mã testcase: TC_WH_08 trong Excel - from.id không khớp employee
    // Arrange
    const req = {
      body: {
        event_name: 'message.text.received',
        message: { text: 'Hi', from: { id: 'z-999' }, message_id: 'm1' },
        sender: {}
      },
      headers: { 'x-bot-api-secret-token': 'secret_u1' }
    };
    const res = buildRes();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Act
    await handleZaloWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unknown employee' });
  });

  it('TC_WH_09 – secret token không hợp lệ → 403', async () => {
    // Tương đương với Mã testcase: TC_WH_09 trong Excel - Secret token sai → 403
    // Arrange
    const req = {
      body: {
        event_name: 'message.text.received',
        message: { text: 'Hi', from: { id: 'z-1' }, message_id: 'm2' },
        sender: {}
      },
      headers: { 'x-bot-api-secret-token': 'wrong-token_u1' }
    };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'emp-1', user_id: 'u1' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: { zalo: { webhook_secret: 'correct-token_u1' } } }] });

    // Act
    await handleZaloWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });

  it('TC_WH_10 – lưu response Zalo thành công (có tracking)', async () => {
    // Tương đương với Mã testcase: TC_WH_10 trong Excel - Zalo webhook lưu thành công
    // Arrange
    const secret = 'mysecret_u1';
    const req = {
      body: {
        event_name: 'message.text.received',
        message: { text: 'Đã xong task', from: { id: 'z-ok' }, message_id: 'm3' },
        sender: {}
      },
      headers: { 'x-bot-api-secret-token': secret }
    };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'emp-2', user_id: 'u2' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: { zalo: { webhook_secret: secret } } }] })
      .mockResolvedValueOnce({ rows: [{ request_id: 'req-x' }] })
      .mockResolvedValueOnce({ rows: [] });

    // Act
    await handleZaloWebhook(req, res);

    // Assert
    const insertArgs = mockQuery.mock.calls[3][1];
    expect(insertArgs).toContain('req-x');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Success' });
  });

  it('TC_WH_11 – lưu response Zalo (không có tracking → requestId = null)', async () => {
    // Tương đương với Mã testcase: TC_WH_11 trong Excel - Không có tracking → requestId null
    // Arrange
    const secret = 'tok_u3';
    const req = {
      body: {
        event_name: 'message.text.received',
        message: { text: 'Xong rồi', from: { id: 'z-new' }, message_id: 'm4' },
        sender: {}
      },
      headers: { 'x-bot-api-secret-token': secret }
    };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'emp-3', user_id: 'u3' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: { zalo: { webhook_secret: secret } } }] })
      .mockResolvedValueOnce({ rows: [] })   // tracking empty
      .mockResolvedValueOnce({ rows: [] });   // INSERT

    // Act
    await handleZaloWebhook(req, res);

    // Assert
    const insertArgs = mockQuery.mock.calls[3][1];
    expect(insertArgs[0]).toBeNull();
    expect(res.json).toHaveBeenCalledWith({ message: 'Success' });
  });

  it('TC_WH_12 – lỗi server → 500', async () => {
    // Arrange
    const req = {
      body: {
        event_name: 'message.text.received',
        message: { text: 'x', from: { id: 'z-err' }, message_id: 'm5' },
        sender: {}
      },
      headers: {}
    };
    const res = buildRes();
    mockQuery.mockRejectedValueOnce(new Error('Fatal'));

    // Act
    await handleZaloWebhook(req, res);

    // Assert – DB crash trong quá trình tìm nhân viên.
    // HTTP 500. Hệ thống báo lỗi nội bộ, webhook không được xử lý.
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  it('TC_WH_13 – secretToken không chứa dấu gạch dưới → userId=null, bỏ qua cache', async () => {
    // Arrange – Token gửi lên không theo đúng định dạng {secret}_{userId}.
    // parts.length < 2 → userId giữ nguyên là null → KHÔNG ghi cache.
    // Nhân viên cũng không tồn tại → trả về Unknown employee.
    const req = {
      body: {
        event_name: 'message.text.received',
        message: { text: 'Hi', from: { id: 'z-nounder' }, message_id: 'm6' },
        sender: {}
      },
      headers: { 'x-bot-api-secret-token': 'noseparator' } // không có '_'
    };
    const res = buildRes();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // employee not found

    // Act
    await handleZaloWebhook(req, res);

    // Assert – Token không đúng định dạng → userId không thể trích xuất → cache bị bỏ qua.
    // HTTP 200. Hệ thống trả về "Unknown employee" vì không tìm thấy nhân viên khớp.
    expect(mockAddZaloMessageToCache).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unknown employee' });
  });

  it('TC_WH_14 – employee tồn tại nhưng chưa có bot_config → bỏ qua kiểm tra token, lưu response', async () => {
    // Arrange – Nhân viên đã liên kết Zalo nhưng manager chưa lưu bot_config.
    // bot_config query trả về rows=[] → bỏ qua kiểm tra secret → response vẫn được lưu bình thường.
    const req = {
      body: {
        event_name: 'message.text.received',
        message: { text: 'Xong việc', from: { id: 'z-noconfig' }, message_id: 'm7' },
        sender: {}
      },
      headers: { 'x-bot-api-secret-token': 'anytoken_u9' }
    };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'emp-9', user_id: 'u9' }] })
      .mockResolvedValueOnce({ rows: [] })  // bot_config không có row
      .mockResolvedValueOnce({ rows: [] })  // tracking empty
      .mockResolvedValueOnce({ rows: [] }); // INSERT response

    // Act
    await handleZaloWebhook(req, res);

    // Assert – Không có bot_config → bỏ qua xác thực token.
    // HTTP 200. Response của nhân viên vẫn được lưu thành công.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Success' });
  });

  it('TC_WH_15 – bot_config tồn tại nhưng platform_configs là null → không xác thực, lưu response', async () => {
    // Arrange – Manager đã tạo bản ghi bot_config nhưng cột platform_configs bị null (chưa điền).
    // platform_configs || {} → fallback về {} → expectedSecret = undefined → bỏ qua kiểm tra token.
    const req = {
      body: {
        event_name: 'message.text.received',
        message: { text: 'Báo cáo xong', from: { id: 'z-nullcfg' }, message_id: 'm8' },
        sender: {}
      },
      headers: { 'x-bot-api-secret-token': 'anything_u10' }
    };
    const res = buildRes();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'emp-10', user_id: 'u10' }] })
      .mockResolvedValueOnce({ rows: [{ platform_configs: null }] }) // platform_configs là null
      .mockResolvedValueOnce({ rows: [] })                            // tracking empty
      .mockResolvedValueOnce({ rows: [] });                           // INSERT response

    // Act
    await handleZaloWebhook(req, res);

    // Assert – platform_configs null → expectedSecret undefined → không reject.
    // HTTP 200. Response được lưu thành công dù config chưa đầy đủ.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Success' });
  });
});
