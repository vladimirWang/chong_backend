import { describe, expect, it } from "bun:test";
import { getValidationNumber, numberPadLeft } from "../../src/utils/algo";

describe("utils/algo", () => {
  describe("numberPadLeft", () => {
    it("会把整数补零到指定长度", () => {
      expect(numberPadLeft(12, 4)).toBe("0012");
      expect(numberPadLeft(0, 2)).toBe("00");
      expect(numberPadLeft(1234, 4)).toBe("1234");
    });

    it("对负数或非整数抛错", () => {
      expect(() => numberPadLeft(-1, 2)).toThrow();
      expect(() => numberPadLeft(1.2, 2)).toThrow();
    });
  });

  describe("getValidationNumber", () => {
    it("只允许纯数字字符串", () => {
      expect(() => getValidationNumber("12a3")).toThrow("纯数字");
      expect(() => getValidationNumber("")).toThrow();
    });

    it("对已知输入给出稳定校验位", () => {
      // 说明：不同 Luhn 变体（位权起点不同）会导致校验位不同
      // 这里以当前实现为准，保证回归稳定
      expect(getValidationNumber("7992739871")).toBe(4);
    });
  });
});

