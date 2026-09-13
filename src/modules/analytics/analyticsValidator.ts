import { z } from "zod";

/** 'YYYY-MM-DD' 查询参数（可选；缺省由 service 取近 7 天） */
const dateParam = z.coerce
  .date()
  .refine((d) => !Number.isNaN(d.getTime()), { message: "必须是有效日期" })
  .optional();

export const analyticsRangeQuerySchema = z
  .object({
    startDate: dateParam,
    endDate: dateParam,
  })
  .refine(
    (data) => {
      if (!data.endDate) return true;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return data.endDate <= today;
    },
    { message: "endDate 不能晚于当天", path: ["endDate"] },
  )
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      const diffDays =
        Math.abs(data.endDate.getTime() - data.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      return diffDays <= 365;
    },
    { message: "startDate 和 endDate 相差不能超过一年", path: ["endDate"] },
  );
export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;
