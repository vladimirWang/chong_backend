import dayjs from "dayjs";
import { IProduct } from "../models/Product";
import _ from "lodash";

export const sum = (arr: number[]) => {
  return arr.reduce((a, c) => a + c, 0);
};

// 获取luhn算法的校验位
export const getValidationNumber = (str: string): number => {
  // 优化1：纯数字校验
  if (!/^\d+$/.test(str)) {
    throw new Error("传入的字符串必须是纯数字格式");
  }
  // 反转
  const reversed = str.split("").reverse();
  // 加权计算
  const weighted = reversed.map((item, idx) => {
    // 对奇数直接保留，即对0, 2, 4直接保留
    if (idx % 2 === 0) {
      return Number(item);
    }
    // 对 偶数位乘以2，若大于等于10，则减去9
    const tmp = Number(item) * 2;
    return tmp >= 10 ? tmp - 9 : tmp;
  });
  const total = sum(weighted);
  const result = (10 - (total % 10)) % 10;
  return result;
};

// 数字左边补零
export const numberPadLeft = (
  n: number,
  length: number,
  padChar: string = "0",
): string => {
  if (n < 0 || Math.floor(n) !== n) {
    throw new Error("待补零的数字必须是大于等于 0 的整数");
  }
  return (n + "").padStart(length, padChar);
};

// luhn算法-生成条形码数字
export const luhn = (
  product: IProduct | { id: number; vendorId: number },
): string => {
  const date = dayjs().format("YYMMDD");
  // // <YYMMDD><vendorId><productId><validationNumber>
  const { id, vendorId } = product;
  const tmp = `${date}${numberPadLeft(vendorId, 4)}${numberPadLeft(id, 4)}`;
  const validationNumber = getValidationNumber(tmp);
  // console.log("validationNumber---:", validationNumber)
  // 221010 0001 0002 6 = 15位
  return `${tmp}${validationNumber}`;
};

/**
 * 对比两个基于 id 标识的对象数组（支持忽略指定字段对比）
 * @param oldArr 旧数组
 * @param newArr 新数组
 * @param idKey 唯一标识字段（必须传入 T 的合法键）
 * @param ignoreFields 对比相等时忽略的字段数组（默认空数组）
 * @returns 分类结果
 */
export type CompareArrayResult<T> = {
  added: T[];
  modified: T[];
  deleted: T[];
  unchanged: T[];
};
export function compareArrayMinLoop<T extends Record<string, any>>(
  oldArr: T[],
  newArr: T[],
  idKey: keyof T,
  //   ignoreFields: (keyof T)[] = [] // 新增：忽略字段参数，类型为T的键数组，默认空
  ignoreFields: any[] = [], // 新增：忽略字段参数，类型为T的键数组，默认空
): CompareArrayResult<T> {
  const result: CompareArrayResult<T> = {
    added: [],
    modified: [], // 修改后的数据
    deleted: [], // 被删除的数据（原始值）
    unchanged: [],
  };

  // 1. 构建旧数组映射（过滤无效ID）
  const oldMap: Record<string | number | symbol, T> = {};
  oldArr.forEach((item) => {
    const idValue = item[idKey];
    if (idValue !== null && idValue !== undefined) {
      oldMap[idValue] = item;
    }
  });

  // 2. 封装「忽略指定字段后对比相等」的函数
  const isEqualIgnoreFields = (a: T, b: T): boolean => {
    // 过滤掉忽略字段，只保留需要对比的字段
    const filteredA = _.omit(a, ignoreFields);
    const filteredB = _.omit(b, ignoreFields);
    // 深度对比过滤后的对象
    return _.isEqual(filteredA, filteredB);
  };

  // 3. 遍历新数组分类
  for (const newItem of newArr) {
    const currentId = newItem[idKey];
    if (currentId === null || currentId === undefined) continue;

    const oldItem = oldMap[currentId];
    if (!oldItem) {
      // 旧数组无此ID → 新增
      result.added.push(newItem);
    } else {
      // 用忽略字段后的逻辑对比是否相等
      const isSame = isEqualIgnoreFields(newItem, oldItem);
      if (isSame) {
        result.unchanged.push(newItem);
      } else {
        result.modified.push(newItem);
      }
      delete oldMap[currentId]; // 标记已处理，剩余为删除项
    }
  }

  // 4. 剩余旧项即为删除项
  result.deleted = Object.values(oldMap);
  return result;
}

export function sum2<T extends Record<K, number>, K extends keyof T>(
  data: T[],
  key: K,
): number {
  return data.reduce((a, c) => {
    const currentValue = c[key] ?? 0;
    return a + currentValue;
  }, 0);
}
