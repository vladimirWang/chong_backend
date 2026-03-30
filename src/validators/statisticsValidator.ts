import { z } from "zod";

/** Zod 4：用 `error`（字符串或 map）替代 Zod 3 的 required_error / invalid_type_error */
const hotSalesDateError = (
  label: string,
): z.core.$ZodErrorMap<z.core.$ZodIssueInvalidType> => (issue) => {
  if (issue.code === "invalid_type") {
    return {
      message:
        issue.input === undefined
          ? `${label} 是必填字段`
          : `${label} 必须是有效的日期`,
    };
  }
  return undefined;
};

// 获取热销商品查询参数 Schema
export const getHotSalesQuerySchema = z
  .object({
    startDate: z.coerce.date({ error: hotSalesDateError("startDate") }),
    endDate: z.coerce.date({ error: hotSalesDateError("endDate") }),
  })
  .refine(
    (data) => {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // 设置为当天的最后一刻
      return data.endDate <= today;
    },
    {
      message: "endDate 不能晚于当天",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      const diffTime = Math.abs(
        data.endDate.getTime() - data.startDate.getTime(),
      );
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      const oneYearInDays = 365;
      return diffDays <= oneYearInDays;
    },
    {
      message: "startDate 和 endDate 相差不能超过一年",
      path: ["endDate"],
    },
  );

export type GetHotSalesQuery = z.infer<typeof getHotSalesQuerySchema>;
