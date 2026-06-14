import { jest } from '@jest/globals';

/**
 * UNIT-JWT-000: Mocking dependencies
 * Mock jsonwebtoken để kiểm soát kết quả sinh/xác thực token.
 */
jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: jest.fn(),
    verify: jest.fn(),
  },
}));

const { generateToken, generateRefreshToken, verifyRefreshToken } = await import("../../src/utils/jwt.js");
const { default: jwt } = await import("jsonwebtoken");

describe("Utils - JWT Functionalities", () => {
  const mockUser = { id: 1, email: "test@example.com" };
  const mockSecret = "test_secret";
  const mockRefreshSecret = "test_refresh_secret";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = mockSecret;
    process.env.JWT_REFRESH_SECRET = mockRefreshSecret;
  });

  /**
   * UNIT-JWT-001: Test generateToken
   * Nghiệp vụ: Tạo Access Token ngắn hạn cho người dùng đăng nhập.
   */
  describe("generateToken", () => {
    it("TC_M1_007 - nên tạo Access Token với payload là id và email, hết hạn sau 1h", async () => {
      jwt.sign.mockReturnValue("mock_access_token");

      const token = generateToken(mockUser);

      // Nghiệp vụ yêu cầu Access Token chỉ có hiệu lực trong 1 giờ để đảm bảo an toàn
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: mockUser.id, email: mockUser.email },
        mockSecret,
        { expiresIn: "1h" }
      );
      expect(token).toBe("mock_access_token");
    });
  });

  describe("generateRefreshToken", () => {
    it("TC_M1_008 - nên tạo Refresh Token với secret riêng biệt (nếu có), hết hạn sau 7d", async () => {
      jwt.sign.mockReturnValue("mock_refresh_token");

      const token = generateRefreshToken(mockUser);

      // Nghiệp vụ yêu cầu Refresh Token có hiệu lực 7 ngày để duy trì phiên làm việc
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: mockUser.id, email: mockUser.email },
        mockRefreshSecret,
        { expiresIn: "7d" }
      );
      expect(token).toBe("mock_refresh_token");
    });

    it("TC_M1_009 - nên dùng JWT_SECRET làm fallback nếu không có JWT_REFRESH_SECRET", async () => {
      delete process.env.JWT_REFRESH_SECRET;
      jwt.sign.mockReturnValue("mock_refresh_token_fallback");

      const token = generateRefreshToken(mockUser);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        mockSecret,
        expect.objectContaining({ expiresIn: "7d" })
      );
      expect(token).toBe("mock_refresh_token_fallback");
    });
  });

  describe("verifyRefreshToken", () => {
    it("TC_M1_010 - nên trả về payload nếu token hợp lệ", async () => {
      const mockPayload = { id: 1, email: "test@example.com" };
      jwt.verify.mockReturnValue(mockPayload);

      const result = verifyRefreshToken("valid_token");

      expect(jwt.verify).toHaveBeenCalledWith("valid_token", mockRefreshSecret);
      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it("TC_M1_011 - nên trả về null nếu token không hợp lệ hoặc đã hết hạn", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const result = verifyRefreshToken("invalid_token");
      expect(result).toBeNull();
    });
    
    it("TC_M1_012 - nên dùng JWT_SECRET làm fallback khi verify nếu không có JWT_REFRESH_SECRET", async () => {
      delete process.env.JWT_REFRESH_SECRET;
      jwt.verify.mockReturnValue({ id: 1 });

      verifyRefreshToken("some_token");
      expect(jwt.verify).toHaveBeenCalledWith("some_token", mockSecret);
    });
  });
});
