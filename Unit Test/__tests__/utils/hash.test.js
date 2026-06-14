import { jest } from '@jest/globals';

/**
 * UNIT-HASH-000: Mocking dependencies
 * Sử dụng jest.unstable_mockModule để mock thư viện bcrypt vì project đang sử dụng ESM (ECMAScript Modules).
 */
jest.unstable_mockModule("bcrypt", () => ({
  default: {
    genSalt: jest.fn(),
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

// Import các hàm cần test sau khi đã mock dependencies
const { hashPassword, comparePassword } = await import("../../src/utils/hash.js");
const { default: bcrypt } = await import("bcrypt");

describe("Utils - Hash Functionalities", () => {
  
  beforeEach(() => {
    // Reset all mocks trước mỗi test case để đảm bảo tính độc lập
    jest.clearAllMocks();
  });

  /**
   * UNIT-HASH-001: Test function hashPassword
   * Mục tiêu: Xác nhận mật khẩu được hash thành công với salt.
   * CheckDB: Không áp dụng (Utility không truy cập DB).
   * Rollback: Không áp dụng.
   */
  describe("hashPassword", () => {
    it("TC_M1_001 - nên trả về chuỗi hash khi cung cấp mật khẩu hợp lệ với salt rounds = 10", async () => {
      const plainPassword = "mySecretPassword123";
      const mockSalt = "generated_salt_string";
      const mockHashed = "hashed_password_string";

      bcrypt.genSalt.mockResolvedValue(mockSalt);
      bcrypt.hash.mockResolvedValue(mockHashed);

      const result = await hashPassword(plainPassword);

      // Xác minh bcrypt.genSalt được gọi với đúng tham số (cost factor = 10) - Đây là yêu cầu nghiệp vụ về bảo mật
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, mockSalt);
      expect(result).toBe(mockHashed);
    });

    it("TC_M1_002 - nên throw error nếu bcrypt.genSalt thất bại", async () => {
      bcrypt.genSalt.mockRejectedValue(new Error("Salt generation error"));
      await expect(hashPassword("password")).rejects.toThrow("Salt generation error");
    });

    it("TC_M1_003 - nên throw error nếu bcrypt.hash thất bại", async () => {
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockRejectedValue(new Error("Hashing error"));
      await expect(hashPassword("password")).rejects.toThrow("Hashing error");
    });
  });

  describe("comparePassword - Positive Case", () => {
    it("TC_M1_004 - nên trả về true khi mật khẩu gốc khớp với chuỗi hash", async () => {
      const plainPassword = "mySecretPassword123";
      const hashedPassword = "hashed_password_string";
      bcrypt.compare.mockResolvedValue(true);

      const isMatch = await comparePassword(plainPassword, hashedPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
      expect(isMatch).toBe(true);
    });
  });

  describe("comparePassword - Negative Case", () => {
    it("TC_M1_005 - nên trả về false khi mật khẩu gốc không khớp với chuỗi hash", async () => {
      const wrongPassword = "wrongPassword";
      const hashedPassword = "hashed_password_string";
      bcrypt.compare.mockResolvedValue(false);

      const isMatch = await comparePassword(wrongPassword, hashedPassword);
      expect(isMatch).toBe(false);
    });

    it("TC_M1_006 - nên throw error nếu bcrypt.compare gặp lỗi hệ thống", async () => {
      bcrypt.compare.mockRejectedValue(new Error("Bcrypt system error"));
      await expect(comparePassword("p", "h")).rejects.toThrow("Bcrypt system error");
    });
  });

});
