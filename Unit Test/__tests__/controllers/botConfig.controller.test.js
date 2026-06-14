import { jest } from '@jest/globals';

// --- MOCKING DEPENDENCIES ---

jest.unstable_mockModule("../../src/config/db.js", () => ({
  default: {
    query: jest.fn(),
  },
}));

jest.unstable_mockModule("axios", () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// --- IMPORTING CONTROLLER & MOCKED MODULES ---
// Sử dụng fake timers TRƯỚC KHI import để bắt được interval trong controller
jest.useFakeTimers();

const { 
  getPlatformUpdates, getBotConfig, updateBotConfig, setZaloWebhook, addZaloMessageToCache 
} = await import("../../src/controllers/botConfig.controller.js");
const db = (await import("../../src/config/db.js")).default;
const axios = (await import("axios")).default;

describe("Controller - BotConfigController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, query: {}, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    
    // Mock console to clean up logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  /**
   * UNIT-CTRL-BOT-001: addZaloMessageToCache
   * Nghiệp vụ: Lưu tin nhắn Zalo vào bộ nhớ tạm để polling.
   */
  describe("addZaloMessageToCache", () => {
    it("TC_M2_001 - nên thêm tin nhắn vào cache và giới hạn 10 tin nhắn", async () => {
      const userId = "user123";
      for (let i = 1; i <= 15; i++) {
        addZaloMessageToCache(userId, { text: `msg ${i}`, from: "sender", message_id: `id${i}` });
      }

      // Kiểm tra thông qua getPlatformUpdates
      req.body = { userId, platform: "zalo" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: {} }] });
      await getPlatformUpdates(req, res);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.result.length).toBe(10);
      expect(responseData.data.result[0].message.text).toBe("msg 6"); // Tin nhắn thứ 6 là tin nhắn cũ nhất còn lại
      expect(responseData.data.result[9].message.text).toBe("msg 15"); // Tin nhắn cuối cùng
    });

    it("TC_M2_002 - nên dọn dẹp cache sau 60s", async () => {
      const userId = "user_clean";
      addZaloMessageToCache(userId, { text: "msg", from: "s", message_id: "id" });
      
      // Tiến tới 70s (vượt quá 60s quy định)
      jest.advanceTimersByTime(70000);
      
      // Kích hoạt interval cleanup (interval chạy mỗi 10s)
      jest.advanceTimersByTime(10000);
      
      // Chạy tất cả các timers đang đợi (bao gồm cả interval logic)
      jest.runOnlyPendingTimers();
      
      // Kiểm tra cache đã trống thông qua getPlatformUpdates
      req.body = { userId, platform: "zalo" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: {} }] });
      await getPlatformUpdates(req, res);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.result.length).toBe(0);
    });
  });

  /**
   * UNIT-CTRL-BOT-002: getPlatformUpdates
   * Nghiệp vụ: Lấy cập nhật mới nhất từ Telegram (webhook proxy) hoặc Zalo (cache).
   */
  describe("getPlatformUpdates", () => {
    it("TC_M2_003 - nên trả về lỗi 400 nếu platform không hỗ trợ", async () => {
      req.body = { userId: "u1", platform: "unknown" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: {} }] });
      await getPlatformUpdates(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it("TC_M2_004 - nên trả về lỗi 400 nếu Telegram chưa cấu hình token", async () => {
      req.body = { userId: "u1", platform: "telegram" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: {} }] });
      await getPlatformUpdates(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it("TC_M2_005 - nên lấy updates Telegram thành công (kèm xử lý webhook)", async () => {
      req.body = { userId: "u1", platform: "telegram" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: { telegram: { bot_token: "token" } } }] });
      
      // Mock các bước: getWebhookInfo (có URL) -> deleteWebhook -> getUpdates -> setWebhook
      axios.get.mockResolvedValueOnce({ data: { result: { url: "http://webhook" } } }); 
      axios.post.mockResolvedValueOnce({}); 
      axios.get.mockResolvedValueOnce({ data: { ok: true, result: [{ message: { text: "hi" } }] } }); 
      axios.post.mockResolvedValueOnce({}); 

      // Gọi hàm và giải quyết setTimeout(1000) bên trong bằng cách đợi timers
      const promise = getPlatformUpdates(req, res);
      await jest.advanceTimersByTimeAsync(1000);
      await promise;
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        status: "success",
        data: expect.objectContaining({ ok: true, result: expect.any(Array) })
      }));
      // Kiểm tra xem có gọi setWebhook để khôi phục không (vì currentWebhookUrl tồn tại)
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("setWebhook"), expect.any(Object));
    });

    it("TC_M2_006 - nên lấy updates Zalo từ cache", async () => {
      const userId = "u_zalo_2";
      addZaloMessageToCache(userId, { text: "hello", from: "me", message_id: "m1" });
      
      req.body = { userId, platform: "zalo" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: {} }] });
      
      await getPlatformUpdates(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        data: expect.objectContaining({ 
          result: expect.arrayContaining([
            expect.objectContaining({ message: expect.objectContaining({ text: "hello" }) })
          ])
        })
      }));
    });

    it("TC_M2_007 - nên trả về 500 nếu lỗi server khi lấy updates", async () => {
      req.body = { userId: "u1", platform: "telegram" };
      db.query.mockRejectedValue(new Error("DB Error"));
      await getPlatformUpdates(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("TC_M2_008 - nên log lỗi nếu Telegram update thất bại", async () => {
      req.body = { userId: "u1", platform: "telegram" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: { telegram: { bot_token: "token" } } }] });
      axios.get.mockRejectedValue(new Error("Telegram API Down"));
      
      await getPlatformUpdates(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });
  });

  /**
   * UNIT-CTRL-BOT-003: getBotConfig
   * Nghiệp vụ: Lấy cấu hình Bot của người dùng.
   */
  describe("getBotConfig", () => {
    it("TC_M2_009 - nên trả về cấu hình mặc định nếu chưa có", async () => {
      req.query = { userId: "u1" };
      db.query.mockResolvedValue({ rows: [] });
      await getBotConfig(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        status: "success", 
        config: expect.objectContaining({
          telegram: expect.any(Object),
          zalo: expect.any(Object)
        }) 
      }));
    });

    it("TC_M2_010 - nên trả về cấu hình hiện tại nếu đã có", async () => {
      req.query = { userId: "u1" };
      const config = { telegram: { bot_token: "123" } };
      db.query.mockResolvedValue({ rows: [{ platform_configs: config }] });
      await getBotConfig(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ config }));
    });

    it("TC_M2_011 - nên trả về 500 nếu lỗi DB khi lấy config", async () => {
      req.query = { userId: "u1" };
      db.query.mockRejectedValue(new Error("Err"));
      await getBotConfig(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-BOT-004: updateBotConfig
   * Nghiệp vụ: Cập nhật cấu hình Bot và tự động set Webhook.
   */
  describe("updateBotConfig", () => {
    it("TC_M2_012 - nên cập nhật thành công và tự động set webhooks", async () => {
      req.body = { 
        userId: "u1", 
        platformConfigs: { 
          telegram: { bot_token: "tg_token" },
          zalo: { bot_token: "za_token", webhook_secret: "secret" }
        } 
      };
      process.env.BACKEND_URL = "http://localhost/api";
      db.query.mockResolvedValue({});
      axios.post.mockResolvedValue({}); // telegram setWebhook & zalo setWebhook

      await updateBotConfig(req, res);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO bot_config"), expect.any(Array));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        status: "success",
        webhooks: expect.objectContaining({ telegram: "success", zalo: "success" })
      }));
    });

    it("TC_M2_013_V1 - nên xử lý được trường hợp Zalo secret rỗng (auto)", async () => {
      req.body = { 
        userId: "u1", 
        platformConfigs: { 
          zalo: { bot_token: "za_token", webhook_secret: "" }
        } 
      };
      db.query.mockResolvedValue({});
      axios.post.mockResolvedValue({});

      await updateBotConfig(req, res);
      const savedConfig = JSON.parse(db.query.mock.calls[0][1][1]);
      expect(savedConfig.zalo.webhook_secret).toBe("auto_u1");
    });

    it("TC_M2_013_V2 - nên xử lý được trường hợp Zalo secret đã có suffix", async () => {
      req.body = { 
        userId: "u1", 
        platformConfigs: { 
          zalo: { bot_token: "za_token", webhook_secret: "mysecret_12345678-1234-1234-1234-123456789012" }
        } 
      };
      db.query.mockResolvedValue({});
      axios.post.mockResolvedValue({});

      await updateBotConfig(req, res);
      // Lấy config đã lưu từ tham số thứ 2 của db.query ([userId, configString])
      const savedConfig = JSON.parse(db.query.mock.calls[0][1][1]);
      expect(savedConfig.zalo.webhook_secret).toBe("mysecret_u1");
    });

    it("TC_M2_014 - nên vẫn thành công nếu set webhook thất bại", async () => {
      req.body = { 
        userId: "u1", 
        platformConfigs: { telegram: { bot_token: "token" } } 
      };
      db.query.mockResolvedValue({});
      axios.post.mockRejectedValue(new Error("Webhook Error"));

      await updateBotConfig(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        webhooks: expect.objectContaining({ telegram: "failed" }) 
      }));
    });

    it("TC_M2_015 - nên log lỗi nếu Zalo auto webhook thất bại", async () => {
      req.body = { 
        userId: "u1", 
        platformConfigs: { zalo: { bot_token: "token", webhook_secret: "s" } } 
      };
      db.query.mockResolvedValue({});
      axios.post.mockRejectedValue(new Error("Zalo API Error"));

      await updateBotConfig(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        webhooks: expect.objectContaining({ zalo: "failed" }) 
      }));
    });

    it("TC_M2_016 - nên trả về 500 nếu lỗi server khi update", async () => {
      req.body = { userId: "u1", platformConfigs: {} };
      db.query.mockRejectedValue(new Error("Err"));
      await updateBotConfig(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-BOT-005: setZaloWebhook
   * Nghiệp vụ: Thiết lập webhook cho Zalo Bot bằng tay.
   */
  describe("setZaloWebhook", () => {
    it("TC_M2_017 - nên trả về 400 nếu thiếu webhookUrl", async () => {
      req.body = { userId: "u1" };
      await setZaloWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it("TC_M2_018 - nên trả về 400 nếu chưa cấu hình bot", async () => {
      req.body = { userId: "u1", webhookUrl: "url" };
      db.query.mockResolvedValue({ rows: [] });
      await setZaloWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it("TC_M2_019 - nên trả về 400 nếu thiếu token Zalo", async () => {
      req.body = { userId: "u1", webhookUrl: "url" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: { zalo: {} } }] });
      await setZaloWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it("TC_M2_020 - nên trả về 400 nếu thiếu secret Zalo", async () => {
      req.body = { userId: "u1", webhookUrl: "url" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: { zalo: { bot_token: "t" } } }] });
      await setZaloWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it("TC_M2_021 - nên set webhook thành công", async () => {
      req.body = { userId: "u1", webhookUrl: "url" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: { zalo: { bot_token: "t", webhook_secret: "s" } } }] });
      axios.post.mockResolvedValue({ data: { message: "ok" } });

      await setZaloWebhook(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        status: "success",
        message: expect.any(String)
      }));
    });

    it("TC_M2_022 - nên trả về 500 nếu lỗi API Zalo", async () => {
      req.body = { userId: "u1", webhookUrl: "url" };
      db.query.mockResolvedValue({ rows: [{ platform_configs: { zalo: { bot_token: "t", webhook_secret: "s" } } }] });
      axios.post.mockRejectedValue({ response: { data: { description: "API Error" } } });

      await setZaloWebhook(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });
  });
});
