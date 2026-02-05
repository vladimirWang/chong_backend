import { z } from "zod";

export const updateIdSchema = z.object({
  id: z.coerce.number(),
});

export type UpdateId = z.infer<typeof updateIdSchema>;

export const paginationSchema = z.object({
  pagination: z.coerce.boolean().optional(),
  limit: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const completedAtSchema = z
  .object({
    completedAt: z.coerce.date().optional(),
  })
  .optional();

export type CompletedAt = z.infer<typeof completedAtSchema>;

export const deletedStartEndSchema = z
  .object({
    deletedStart: z.coerce.date().optional(),
    deletedEnd: z.coerce.date().optional(),
  })
  .optional()
  .refine(
    (data) => {
      if (!data.deletedStart || !data.deletedEnd) {
        return false;
      }
      return (
        new Date(data.deletedEnd).getTime() <=
        new Date(data.deletedStart).getTime()
      );
    },
    {
      message: "startDate 和 endDate 相差不能超过一年",
      path: ["endDate"],
    },
  );

export type DeletedStartEnd = z.infer<typeof deletedStartEndSchema>;

export const vendorIdSchema = z.object({
  vendorId: z.coerce.number()
})
export type VendorId = z.infer<typeof vendorIdSchema>;

export const productNameStringSchema = z.object({
  productName: z.string()
})

export type ProductNameString = z.infer<typeof productNameStringSchema>;