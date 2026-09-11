/**
 * 登录态注入的 user 对象结构（来自 Redis 中保存的 JWT payload，与 repo_backend AuthUser 一致）
 */
export interface AuthUser {
  userId: number;
  email: string;
  username: string | null;
  tenantId: number;
  role?: string;
  exp?: number;
  [k: string]: unknown;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser | undefined;
  }
}
