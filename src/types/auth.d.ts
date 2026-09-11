import type { TenantPrismaClient } from "../utils/prisma";

/**
 * 登录态注入的 user 对象结构（来自 Redis 中保存的 JWT payload，与 repo_backend AuthUser 一致）
 */
export interface AuthUser {
  userId: number;
  email: string;
  username: string | null;
  tenantId: number | null;
  role?: string;
  exp?: number;
  [k: string]: unknown;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser | undefined;
    /** 带当前 tenantId 过滤的 prisma 实例（业务表 CRUD 一律用它） */
    tenantPrisma: TenantPrismaClient;
    /** 当前租户 ID（等价于 user.tenantId，方便解构） */
    tenantId: number;
  }
}
