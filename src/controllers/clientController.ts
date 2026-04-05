import prisma from "../utils/prisma";
import { SuccessResponse } from "../models/Response";
import {
  CreateClientBody,
  ClientQuery,
  PatchClientBody,
} from "../validators/clientValidator";
import { getPaginationValues, getWhereValues } from "../utils/db";
import { UpdateId } from "../validators/commonValidator";

export const getClients = async ({ query }: { query: ClientQuery }) => {
  const { limit = 10, page = 1, name, tel, address, pagination = 1 } = query;
  console.log("get clients pagination: ", pagination);
  const { skip, take } = getPaginationValues({ limit, page });

  const whereValues = getWhereValues({ name, tel, address });
  const results = await prisma.$transaction([
    prisma.client.findMany({
      skip: pagination ? skip : undefined,
      take: pagination ? take : undefined,
      where: whereValues,
    }),
    prisma.client.count({
      where: whereValues,
    }),
  ]);
  return new SuccessResponse(
    { total: results[1], list: results[0] },
    "客户列表获取成功",
  );
};

export const createClient = async ({ body }: { body: CreateClientBody }) => {
  const { name, tel, address, remark } = body;
  const client = await prisma.client.create({
    data: { name, tel, address, remark },
  });
  return new SuccessResponse(client, "客户创建成功");
};

export const patchClient = async ({
  body,
  params,
}: {
  body: PatchClientBody;
  params: UpdateId;
}) => {
  const { name, tel, address, remark } = body;
  const client = await prisma.client.update({
    where: { id: params.id },
    data: { name, tel, address, remark },
  });
  return new SuccessResponse(client, "客户更新成功");
};

export const getClientDetailById = async ({ params }: { params: UpdateId }) => {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
  });
  return new SuccessResponse(client, "客户详情查询成功");
};
