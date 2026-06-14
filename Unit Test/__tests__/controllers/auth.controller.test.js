import { jest } from '@jest/globals';

// --- MOCKING DEPENDENCIES ---

jest.unstable_mockModule("../../src/models/user.model.js", () => ({
  findUserByGmail: jest.fn(),
  findUserByPhone: jest.fn(),
  createUser: jest.fn(),
  findUserById: jest.fn(),
  updateUserById: jest.fn(),
  updateUserPasswordById: jest.fn(),
  updateUserEmail: jest.fn(),
}));

jest.unstable_mockModule("../../src/models/tokenModel.js", () => ({
  createToken: jest.fn(),
  findTokenByUserId: jest.fn(),
  updateToken: jest.fn(),
  deleteTokenByUserId: jest.fn(),
  findTokenByClientCredentials: jest.fn(),
}));

jest.unstable_mockModule("../../src/utils/hash.js", () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));

jest.unstable_mockModule("../../src/utils/jwt.js", () => ({
  generateToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
}));

jest.unstable_mockModule("nodemailer", () => ({
  default: {
    createTransport: jest.fn().mockReturnValue({
      sendMail: jest.fn().mockResolvedValue(true),
    }),
  },
}));

jest.unstable_mockModule("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue("https://google.com/auth"),
        getToken: jest.fn().mockResolvedValue({ tokens: { access_token: "at", refresh_token: "rt", expiry_date: Date.now() + 3600000 } }),
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({ credentials: { access_token: "new_at", expiry_date: Date.now() + 3600000 } }),
      })),
    },
    oauth2: jest.fn().mockReturnValue({
      userinfo: {
        get: jest.fn().mockResolvedValue({ data: { email: "u@g.c", name: "Name" } }),
      },
    }),
  },
}));

jest.unstable_mockModule("crypto", () => ({
  default: {
    randomBytes: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue("random_hex"),
    }),
  },
}));

// --- IMPORTING CONTROLLER & MOCKED MODULES ---
const { 
  register, login, refreshToken, getProfile, 
  updateProfile, changePassword, updateEmail, 
  verifyEmail, verifyEmailCallback, forgotPassword, 
  refreshGoogleToken, getGoogleStatus, unlinkGoogle 
} = await import("../../src/controllers/auth.controller.js");
const userModel = await import("../../src/models/user.model.js");
const tokenModel = await import("../../src/models/tokenModel.js");
const hashUtils = await import("../../src/utils/hash.js");
const jwtUtils = await import("../../src/utils/jwt.js");

describe("Controller - AuthController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, cookies: {}, user: {}, query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    
    // Mock console để sạch log
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  /**
   * UNIT-CTRL-AUTH-001: Register
   */
  describe("register", () => {
    it("TC_M1_020 - nên trả về 400 nếu thiếu gmail, password hoặc fullName", async () => {
      req.body = { gmail: "test@gmail.com" };
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "error",
        message: expect.any(String)
      }));
    });

    it("TC_M1_021 - nên trả về 400 nếu Gmail đã tồn tại", async () => {
      req.body = { gmail: "existed@gmail.com", password: "password123", fullName: "Test User" };
      userModel.findUserByGmail.mockResolvedValue({ id: 1 });
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "error",
        message: expect.any(String)
      }));
    });

    it("TC_M1_022 - nên trả về 400 nếu Số điện thoại đã tồn tại", async () => {
      req.body = { gmail: "new@gmail.com", password: "password123", fullName: "Test User", phone: "0901234567" };
      userModel.findUserByGmail.mockResolvedValue(null);
      userModel.findUserByPhone.mockResolvedValue({ id: 2 });
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "error",
        message: expect.any(String)
      }));
    });

    it("TC_M1_023 - nên trả về 400 nếu mật khẩu quá ngắn", async () => {
      req.body = { gmail: "new@gmail.com", password: "short", fullName: "Name" };
      userModel.findUserByGmail.mockResolvedValue(null);
      userModel.findUserByPhone.mockResolvedValue(null);
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "error",
        message: expect.any(String)
      }));
    });

    it("TC_M1_024 - nên đăng ký thành công nếu dữ liệu hợp lệ", async () => {
      const userData = { gmail: "valid@gmail.com", password: "longpassword", fullName: "Valid User", phone: "123456", date: "2000-01-01" };
      req.body = userData;
      userModel.findUserByGmail.mockResolvedValue(null);
      userModel.findUserByPhone.mockResolvedValue(null);
      hashUtils.hashPassword.mockResolvedValue("hashed_pass");
      userModel.createUser.mockResolvedValue({ 
        id: 100, 
        gmail: userData.gmail, 
        name: userData.fullName, 
        phone_number: userData.phone, 
        date_of_birth: userData.date,
        created_at: new Date()
      });
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        data: expect.objectContaining({
          userId: 100,
          gmail: "valid@gmail.com"
        })
      }));
    });
    
    it("TC_M1_025 - nên trả về 500 nếu có lỗi server khi đăng ký", async () => {
      req.body = { gmail: "e@g.c", password: "pass", fullName: "Name" };
      userModel.findUserByGmail.mockRejectedValue(new Error("Err"));
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "error"
      }));
    });
  });

  /**
   * UNIT-CTRL-AUTH-002: Login
   */
  describe("login", () => {
    it("TC_M1_026 - nên trả về 400 nếu thiếu thông tin", async () => {
      req.body = {};
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it("TC_M1_027 - nên trả về 400 nếu tài khoản không tồn tại", async () => {
      req.body = { gmail: "non@g.c", password: "123" };
      userModel.findUserByGmail.mockResolvedValue(null);
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it("TC_M1_028 - nên trả về 400 nếu sai mật khẩu", async () => {
      req.body = { gmail: "user@gmail.com", password: "wrong_password" };
      userModel.findUserByGmail.mockResolvedValue({ id: 1, password: "hashed" });
      hashUtils.comparePassword.mockResolvedValue(false);
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it("TC_M1_029 - nên đăng nhập thành công", async () => {
      req.body = { gmail: "u@g.c", password: "p" };
      userModel.findUserByGmail.mockResolvedValue({ id: 1, gmail: "u@g.c", password: "h", name: "User" });
      hashUtils.comparePassword.mockResolvedValue(true);
      jwtUtils.generateToken.mockReturnValue("at");
      jwtUtils.generateRefreshToken.mockReturnValue("rt");
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalledWith("accessToken", "at", expect.any(Object));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        data: expect.objectContaining({ accessToken: "at" })
      }));
    });
    
    it("TC_M1_030 - nên trả về 500 nếu lỗi server khi login", async () => {
      req.body = { gmail: "e@g.c", password: "p" };
      userModel.findUserByGmail.mockRejectedValue(new Error("Err"));
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-003: Refresh Token
   */
  describe("refreshToken", () => {
    it("TC_M1_031 - nên trả về 401 nếu không có token", async () => {
      await refreshToken(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it("TC_M1_032 - nên trả về 403 nếu token không hợp lệ", async () => {
      req.cookies.refreshToken = "token";
      jwtUtils.verifyRefreshToken.mockReturnValue(null);
      await refreshToken(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it("TC_M1_033_V1 - nên refresh thành công khi lấy token từ request body (Mobile)", async () => {
      req.cookies = {}; // Không có cookie
      req.body.refreshToken = "token_from_body";
      jwtUtils.verifyRefreshToken.mockReturnValue({ id: 1, email: "u@g.c" });
      jwtUtils.generateToken.mockReturnValue("at");
      await refreshToken(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success"
      }));
    });

    it("TC_M1_033 - nên refresh thành công", async () => {
      req.cookies.refreshToken = "token";
      jwtUtils.verifyRefreshToken.mockReturnValue({ id: 1, email: "u@g.c" });
      jwtUtils.generateToken.mockReturnValue("at");
      await refreshToken(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        data: expect.objectContaining({ accessToken: "at" })
      }));
    });

    it("TC_M1_034 - nên trả về 500 nếu lỗi server", async () => {
      req.cookies.refreshToken = "token";
      jwtUtils.verifyRefreshToken.mockImplementation(() => { throw new Error("Err"); });
      await refreshToken(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-004: Get Profile
   */
  describe("getProfile", () => {
    it("TC_M1_035 - nên trả về profile", async () => {
      req.user = { id: 1 };
      userModel.findUserById.mockResolvedValue({ id: 1, gmail: "u@g.c", name: "Name" });
      await getProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        data: expect.objectContaining({ gmail: "u@g.c" })
      }));
    });

    it("TC_M1_036 - nên trả về 404 nếu không thấy", async () => {
      req.user = { id: 1 };
      userModel.findUserById.mockResolvedValue(null);
      await getProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it("TC_M1_037 - nên trả về 500", async () => {
      req.user = { id: 1 };
      userModel.findUserById.mockRejectedValue(new Error("Err"));
      await getProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-005: Update Profile
   */
  describe("updateProfile", () => {
    it("TC_M1_038 - nên update thành công", async () => {
      req.user = { id: 1 };
      req.body = { username: "new", phone: "090" };
      userModel.updateUserById.mockResolvedValue({ id: 1, name: "new" });
      await updateProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        message: expect.any(String)
      }));
    });
    
    it("TC_M1_039 - nên trả về 500", async () => {
      userModel.updateUserById.mockRejectedValue(new Error("Err"));
      await updateProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-006: Change Password
   */
  describe("changePassword", () => {
    it("TC_M1_040_V1 - nên trả về 400 nếu thiếu thông tin mật khẩu", async () => {
      req.body = { oldPassword: "1" }; // Thiếu newPassword và confirmPassword
      await changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("TC_M1_040_V2 - nên trả về 400 nếu mật khẩu xác nhận không khớp", async () => {
      req.body = { oldPassword: "1", newPassword: "2", confirmPassword: "3" };
      await changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it("TC_M1_040_V3 - nên trả về 404 nếu không tìm thấy người dùng", async () => {
      req.user = { id: 999 };
      req.body = { oldPassword: "old", newPassword: "new_pass_8", confirmPassword: "new_pass_8" };
      userModel.findUserById.mockResolvedValue(null);
      await changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("TC_M1_040_V4 - nên trả về 400 nếu mật khẩu cũ không chính xác", async () => {
      req.user = { id: 1 };
      req.body = { oldPassword: "wrong_old", newPassword: "new_pass_8", confirmPassword: "new_pass_8" };
      userModel.findUserById.mockResolvedValue({ password: "hashed_old" });
      hashUtils.comparePassword.mockResolvedValue(false);
      await changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("TC_M1_040_V5 - nên trả về 400 nếu mật khẩu mới quá ngắn", async () => {
      req.user = { id: 1 };
      req.body = { oldPassword: "old", newPassword: "short", confirmPassword: "short" };
      userModel.findUserById.mockResolvedValue({ password: "hashed_old" });
      hashUtils.comparePassword.mockResolvedValue(true);
      await changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("TC_M1_041 - nên đổi thành công", async () => {
      req.user = { id: 1 };
      req.body = { oldPassword: "old", newPassword: "new_pass_8", confirmPassword: "new_pass_8" };
      userModel.findUserById.mockResolvedValue({ password: "hashed_old" });
      hashUtils.comparePassword.mockResolvedValue(true);
      hashUtils.hashPassword.mockResolvedValue("hashed_new");
      await changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success"
      }));
    });

    it("TC_M1_042 - nên trả về 500", async () => {
      req.user = { id: 1 };
      req.body = { oldPassword: "1", newPassword: "new_pass_8", confirmPassword: "new_pass_8" };
      userModel.findUserById.mockRejectedValue(new Error("Err"));
      await changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-007: Update Email
   */
  describe("updateEmail", () => {
    it("TC_M1_043_V1 - nên trả về 400 nếu thiếu email mới", async () => {
      req.body = {};
      await updateEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("TC_M1_043_V2 - nên trả về 400 nếu email mới trùng email hiện tại", async () => {
      req.user = { id: 1 };
      req.body = { newEmail: "old@gmail.com" };
      userModel.findUserById.mockResolvedValue({ gmail: "old@gmail.com" });
      await updateEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("TC_M1_043 - nên update thành công", async () => {
      req.user = { id: 1 };
      req.body = { newEmail: "n@g.c" };
      userModel.findUserById.mockResolvedValue({ gmail: "o@g.c" });
      userModel.updateUserEmail.mockResolvedValue({ id: 1, gmail: "n@g.c" });
      await updateEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        message: expect.any(String)
      }));
    });

    it("TC_M1_043_V3 - nên log cảnh báo nếu xóa token Google cũ thất bại nhưng vẫn tiếp tục", async () => {
      req.user = { id: 1 };
      req.body = { newEmail: "n@g.c" };
      userModel.findUserById.mockResolvedValue({ gmail: "o@g.c" });
      tokenModel.deleteTokenByUserId.mockRejectedValue(new Error("Delete failed"));
      userModel.updateUserEmail.mockResolvedValue({ id: 1, gmail: "n@g.c" });
      
      await updateEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Không thể xóa token Google cũ"), expect.any(Error));
    });

    it("TC_M1_044 - nên trả về 500", async () => {
      req.user = { id: 1 };
      req.body = { newEmail: "n@g.c" };
      userModel.findUserById.mockRejectedValue(new Error("Err"));
      await updateEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-008: Verify Email
   */
  describe("verifyEmail", () => {
    it("TC_M1_045_V1 - nên trả về 400 nếu thiếu client credentials", async () => {
      req.body = { client_id: "id" }; // Thiếu secret
      await verifyEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("TC_M1_045_V2 - nên trả về 400 nếu client credentials đã tồn tại", async () => {
      req.body = { client_id: "i", client_secret: "s" };
      tokenModel.findTokenByClientCredentials.mockResolvedValue({ id: 123 });
      await verifyEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("TC_M1_045 - nên tạo URL thành công", async () => {
      req.body = { client_id: "i", client_secret: "s" };
      tokenModel.findTokenByClientCredentials.mockResolvedValue(null);
      await verifyEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        url: "https://google.com/auth"
      }));
    });

    it("TC_M1_046 - nên trả về 500 nếu lỗi khi kiểm tra credentials", async () => {
      req.body = { client_id: "i", client_secret: "s" };
      tokenModel.findTokenByClientCredentials.mockRejectedValue(new Error("DB Error"));
      
      await verifyEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    });
  });

  /**
   * UNIT-CTRL-AUTH-009: Verify Callback
   */
  describe("verifyEmailCallback", () => {
    it("TC_M1_047_V1 - nên trả về 400 nếu thiếu code hoặc state", async () => {
      req.query = { code: "123" }; // Thiếu state
      await verifyEmailCallback(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("TC_M1_047_V2 - nên trả về 404 nếu không tìm thấy user từ email Google trả về", async () => {
      req.query = { code: "c", state: JSON.stringify({ client_id: "i", client_secret: "s" }) };
      userModel.findUserByGmail.mockResolvedValue(null);
      await verifyEmailCallback(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("TC_M1_047 - nên redirect thành công", async () => {
      req.query = { code: "c", state: JSON.stringify({ client_id: "i", client_secret: "s" }) };
      userModel.findUserByGmail.mockResolvedValue({ id: 1 });
      tokenModel.createToken.mockResolvedValue({});
      await verifyEmailCallback(req, res);
      expect(res.redirect).toHaveBeenCalled();
    });

    it("TC_M1_048 - nên trả về 500", async () => {
      req.query = { code: "c", state: JSON.stringify({ client_id: "i", client_secret: "s" }) };
      userModel.findUserByGmail.mockRejectedValue(new Error("Err"));
      await verifyEmailCallback(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-010: Forgot Password
   */
  describe("forgotPassword", () => {
    it("TC_M1_049_V1 - nên trả về 404 nếu không thấy email", async () => {
      req.body = { gmail: "non-existent@gmail.com" };
      userModel.findUserByGmail.mockResolvedValue(null);
      await forgotPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("TC_M1_049 - nên reset thành công", async () => {
      req.body = { gmail: "e@g.c" };
      userModel.findUserByGmail.mockResolvedValue({ id: 1 });
      hashUtils.hashPassword.mockResolvedValue("h");
      await forgotPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String)
      }));
    });

    it("TC_M1_050 - nên trả về 500", async () => {
      req.body = { gmail: "e" };
      userModel.findUserByGmail.mockRejectedValue(new Error("Err"));
      await forgotPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-011: Refresh Google Token
   */
  describe("refreshGoogleToken", () => {
    it("TC_M1_051_V1 - nên trả về 404 nếu chưa liên kết Gmail", async () => {
      req.user = { id: 1 };
      tokenModel.findTokenByUserId.mockResolvedValue(null);
      await refreshGoogleToken(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("TC_M1_051_V2 - nên trả về 400 nếu không có refresh_token", async () => {
      req.user = { id: 1 };
      tokenModel.findTokenByUserId.mockResolvedValue({ refresh_token: null });
      await refreshGoogleToken(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("TC_M1_051 - nên refresh thành công", async () => {
      req.user = { id: 1 };
      tokenModel.findTokenByUserId.mockResolvedValue({ client_id: "i", client_secret: "s", refresh_token: "r" });
      tokenModel.updateToken.mockResolvedValue({});
      await refreshGoogleToken(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        data: expect.objectContaining({ access_token: "new_at" })
      }));
    });

    it("TC_M1_052 - nên trả về 500", async () => {
      req.user = { id: 1 };
      tokenModel.findTokenByUserId.mockRejectedValue(new Error("Err"));
      await refreshGoogleToken(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-012: Google Status
   */
  describe("getGoogleStatus", () => {
    it("TC_M1_053_V1 - nên trả về verified: false nếu chưa liên kết", async () => {
      req.user = { id: 1 };
      tokenModel.findTokenByUserId.mockResolvedValue(null);
      await getGoogleStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ verified: false })
      }));
    });

    it("TC_M1_053 - nên trả về status", async () => {
      req.user = { id: 1 };
      tokenModel.findTokenByUserId.mockResolvedValue({ client_id: "my-client-id-is-long-1234" });
      await getGoogleStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        data: expect.objectContaining({ verified: true })
      }));
    });

    it("TC_M1_054 - nên trả về 500", async () => {
      req.user = { id: 1 };
      tokenModel.findTokenByUserId.mockRejectedValue(new Error("Err"));
      await getGoogleStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /**
   * UNIT-CTRL-AUTH-013: Unlink Google
   */
  describe("unlinkGoogle", () => {
    it("TC_M1_055 - nên unlink thành công", async () => {
      req.user = { id: 1 };
      tokenModel.deleteTokenByUserId.mockResolvedValue({});
      await unlinkGoogle(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "success"
      }));
    });

    it("TC_M1_056 - nên trả về 500", async () => {
      req.user = { id: 1 };
      tokenModel.deleteTokenByUserId.mockRejectedValue(new Error("Err"));
      await unlinkGoogle(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

});