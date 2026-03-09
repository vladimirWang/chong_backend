import prisma from "../utils/prisma";
import { SuccessResponse } from "../models/Response";

export const getPlatforms = async () => {
  const platforms = await prisma.platform.findMany();
  return new SuccessResponse(platforms, "平台列表获取成功");
};
