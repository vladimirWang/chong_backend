/** 分页参数 → prisma skip/take（移植自 repo_backend utils/db） */
export function getPaginationValues({ limit = 10, page = 1 } = {}) {
  return {
    skip: (page - 1) * limit,
    take: limit * 1,
  };
}

/** 把 { name: "x" } 这类等值键值对转成 prisma contains 模糊查询条件（忽略空值） */
export function getWhereValues(pairs: Record<string, unknown>) {
  return Object.keys(pairs).reduce<Record<string, { contains: unknown }>>(
    (acc, key) => {
      const value = pairs[key];
      if (value) {
        acc[key] = { contains: value };
      }
      return acc;
    },
    {},
  );
}
