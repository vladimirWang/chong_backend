import { z } from "zod";

/** GET /statistics/* 通用日期区间 query（startDate/endDate 均为 'YYYY-MM-DD'） */
export const dateRangeQuerySchema = z
  .object({
    startDate: z.coerce.date({ message: "startDate 是必填字段" }),
    endDate: z.coerce.date({ message: "endDate 是必填字段" }),
  })
  .refine(
    (data) => {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // 当天最后一刻
      return data.endDate <= today;
    },
    {
      message: "endDate 不能晚于当天",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      const diffDays =
        Math.abs(data.endDate.getTime() - data.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      return diffDays <= 365;
    },
    {
      message: "startDate 和 endDate 相差不能超过一年",
      path: ["endDate"],
    },
  );
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
