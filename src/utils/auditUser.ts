import type { JwtPayload } from "../controllers/userController";

// /**
//  * 无登录上下文时的审计用户（如公开申请接口），须为 `User` 表中存在的 id（历史迁移曾用 3 回填）。
//  */
// export function systemAuditUserId(): number {
//   const v = process.env.SYSTEM_AUDIT_USER_ID;
//   if (v !== undefined && v !== "") return Number(v);
//   return 3;
// }

export function auditCreate(userId: number) {
  return {
    createdBy: userId,
    updatedBy: userId,
    deletedBy: userId,
  };
}

export function auditUpdate(userId: number) {
  return { updatedBy: userId };
}

export function auditSoftDelete(userId: number, deletedAt: Date = new Date()) {
  return { deletedAt, deletedBy: userId };
}

/** 与其它 relation 字段混用时用 connect，避免 Prisma CreateInput/UpdateInput 互斥 */
export function auditCreateConnect(userId: number) {
  return {
    createdByUser: { connect: { id: userId } },
    updatedByUser: { connect: { id: userId } },
    deletedByUser: { connect: { id: userId } },
  };
}

export function auditUpdateConnect(userId: number) {
  return { updatedByUser: { connect: { id: userId } } };
}
