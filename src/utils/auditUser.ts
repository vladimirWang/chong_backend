/** create 时审计字段（标量形式） */
export function auditCreate(userId: number) {
  return {
    createdBy: userId,
    updatedBy: userId,
    deletedBy: userId,
  };
}

/** update 时审计字段 */
export function auditUpdate(userId: number) {
  return { updatedBy: userId };
}

/** 软删除时审计字段 */
export function auditSoftDelete(userId: number, deletedAt: Date = new Date()) {
  return { deletedAt, deletedBy: userId };
}

/** create 时审计字段（relation connect 形式，避免与其它 relation 字段互斥） */
export function auditCreateConnect(userId: number) {
  return {
    createdByUser: { connect: { id: userId } },
    updatedByUser: { connect: { id: userId } },
  };
}

/** update 时审计字段（relation connect 形式，用于嵌套/关系语法场景） */
export function auditUpdateConnect(userId: number) {
  return { updatedByUser: { connect: { id: userId } } };
}
