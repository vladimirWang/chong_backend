import { t } from "elysia";

/** OData 常用查询参数，均可选，透传给 Graph */
export const microsoftTodoODataQuerySchema = t.Object({
  $top: t.Optional(t.String()),
  $skip: t.Optional(t.String()),
  $filter: t.Optional(t.String()),
  $orderby: t.Optional(t.String()),
  $select: t.Optional(t.String()),
  $expand: t.Optional(t.String()),
});

export const microsoftTodoListIdSchema = t.Object({
  listId: t.String({ minLength: 1 }),
});
