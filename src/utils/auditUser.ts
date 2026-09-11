/** create 时审计字段（relation connect 形式，避免与其它 relation 字段互斥） */
export function auditCreateConnect(userId: number) {
  return {
    createdByUser: { connect: { id: userId } },
    updatedByUser: { connect: { id: userId } },
  };
}

/** update 时审计字段 */
export function auditUpdate(userId: number) {
  return { updatedBy: userId };
}
