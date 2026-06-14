import { jest } from '@jest/globals';

/**
 * UNIT-MW-AUTH-000: Mocking dependencies
 * Mock jsonwebtoken để điều khiển các trường hợp verify thành công/thất bại/hết hạn.
 */
jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    verify: jest.fn(),
    sign: jest.fn(),
  },
}));

const { verifyToken } = await import("../../src/middleware/auth.middleware.js");
const { default: jwt } = await import("jsonwebtoken");

describe("Middleware - verifyToken", () => {
  let req, res, next;
  const mockSecret = "test_secret";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = mockSecret;

    // Giả lập Request, Response và Next function của Express
    req = {
      cookies: {},
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    
    // Mock console để tránh làm bẩn log output khi chạy test
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  /**
   * UNIT-MW-AUTH-001: Trường hợp chưa đăng nhập
   * Nghiệp vụ: Chặn truy cập nếu không có bất kỳ token nào.
   */
  it("TC_M1_013 - nên trả về 401 nếu không tìm thấy accessToken trong cookie hoặc header", async () => {
    await verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
      message: expect.any(String) 
    }));
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * UNIT-MW-AUTH-002: Trường hợp token hợp lệ (Cookie)
   * Nghiệp vụ: Cho phép truy cập nếu Access Token còn hiệu lực.
   */
  it("TC_M1_014 - nên xác thực thành công và gọi next() nếu accessToken trong cookie hợp lệ", async () => {
    req.cookies.accessToken = "valid_cookie_token"; 
    const mockUser = { id: 123, email: "test@gmail.com" };
    jwt.verify.mockReturnValue(mockUser);

    await verifyToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith("valid_cookie_token", mockSecret);
    expect(req.user).toEqual(expect.objectContaining({ id: 123 }));
    expect(next).toHaveBeenCalled();
  });

  /**
   * UNIT-MW-AUTH-003: Trường hợp token hợp lệ (Header - Mobile)
   * Nghiệp vụ: Hỗ trợ xác thực cho ứng dụng di động qua header Authorization.
   */
  it("TC_M1_015 - nên xác thực thành công nếu accessToken trong header Authorization hợp lệ", async () => {
    req.headers.authorization = "Bearer valid_header_token";
    const mockUser = { id: 456, email: "mobile@gmail.com" };
    jwt.verify.mockReturnValue(mockUser);

    await verifyToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith("valid_header_token", mockSecret);
    expect(req.user).toEqual(expect.objectContaining({ id: 456 }));
    expect(next).toHaveBeenCalled();
  });

  /**
   * UNIT-MW-AUTH-004: Trường hợp Access Token hết hạn nhưng không có Refresh Token
   * Nghiệp vụ: Yêu cầu người dùng đăng nhập lại nếu phiên làm việc thực sự kết thúc.
   */
  it("TC_M1_016 - nên trả về 403 nếu accessToken hết hạn và không có refreshToken", async () => {
    req.cookies.accessToken = "expired_token";
    const expireError = new Error("Token expired");
    expireError.name = "TokenExpiredError";
    jwt.verify.mockImplementation(() => { throw expireError; });

    await verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
      message: expect.any(String) 
    }));
  });

  /**
   * UNIT-MW-AUTH-005: Trường hợp Tự động làm mới (Auto Refresh)
   * Nghiệp vụ: Tự động cấp Access Token mới nếu Refresh Token còn hạn, giúp trải nghiệm người dùng không bị ngắt quãng.
   */
  it("TC_M1_017 - nên tạo accessToken mới và gọi next() nếu accessToken hết hạn nhưng refreshToken hợp lệ", async () => {
    req.cookies.accessToken = "expired_token";
    req.cookies.refreshToken = "valid_refresh_token";
    
    const expireError = new Error("Token expired");
    expireError.name = "TokenExpiredError";
    
    // Lần 1 verify accessToken -> fail (expired)
    // Lần 2 verify refreshToken -> success
    jwt.verify
      .mockImplementationOnce(() => { throw expireError; })
      .mockReturnValueOnce({ id: 789, email: "refresh@gmail.com" });
      
    jwt.sign.mockReturnValue("new_access_token");

    await verifyToken(req, res, next);

    expect(jwt.sign).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith("accessToken", "new_access_token", expect.objectContaining({
      httpOnly: true,
      maxAge: expect.any(Number)
    }));
    expect(req.user).toEqual(expect.objectContaining({ id: 789 }));
    expect(next).toHaveBeenCalled();
  });

  /**
   * UNIT-MW-AUTH-006: Trường hợp Refresh Token không hợp lệ
   * Nghiệp vụ: Từ chối truy cập nếu cả Refresh Token cũng hỏng/hết hạn.
   */
  it("TC_M1_018 - nên trả về 403 nếu cả accessToken and refreshToken đều không hợp lệ/hết hạn", async () => {
    req.cookies.accessToken = "expired_token";
    req.cookies.refreshToken = "invalid_refresh_token";
    
    const expireError = new Error("Token expired");
    expireError.name = "TokenExpiredError";
    
    jwt.verify.mockImplementation(() => { throw expireError; });

    await verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
      message: expect.any(String) 
    }));
  });

  /**
   * UNIT-MW-AUTH-007: Trường hợp Token không hợp lệ (Sai format, sai secret)
   * Nghiệp vụ: Chống giả mạo token.
   */
  it("TC_M1_019 - nên trả về 403 nếu accessToken không hợp lệ (không phải lỗi hết hạn)", async () => {
    req.cookies.accessToken = "fake_token";
    jwt.verify.mockImplementation(() => { 
      const err = new Error("JsonWebTokenError");
      err.name = "JsonWebTokenError";
      throw err;
    });

    await verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
      message: expect.any(String) 
    }));
  });
});
