import { v4 as uuidv4 } from "uuid";
import prisma from "./prisma";

/** 交互式事务的 tx 类型（项目 prisma 实例带 $extends，不能用裸的 Prisma.TransactionClient） */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** 生成租户机器编码：uuid 去连字符取 12 位，@unique 下碰撞概率可忽略 */
function genTenantCode() {
  return uuidv4().replace(/-/g, "").slice(0, 12);
}

/**
 * 在事务内创建租户并返回完整记录。
 * 一用户一租户约定：注册即建租户；name 缺省时按 用户名 → 邮箱前缀 兜底。
 */
export async function createTenantInTx(
  tx: PrismaTx,
  opts: {
    name?: string | null;
    fallbackUsername?: string | null;
    fallbackEmail?: string;
  },
) {
  const name =
    opts.name?.trim() ||
    opts.fallbackUsername?.trim() ||
    opts.fallbackEmail?.split("@")[0] ||
    "未命名租户";
  return tx.tenant.create({
    data: { name, code: genTenantCode() },
  });
}
