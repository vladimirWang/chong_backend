import dayjs from "dayjs";
import { IProduct } from "../models/Product";

export const sum = (arr: number[]) => {
    return arr.reduce((a, c) => a + c, 0);
}

export const getValidationNumber = (str: string) => {
    // 优化1：纯数字校验
    if (!/^\d+$/.test(str)) {
        throw new Error("传入的字符串必须是纯数字格式");
    }
    // 反转
    const reversed = str.split('').reverse();
    // 加权计算
    const weighted = reversed.map((item, idx) => {
        // 对奇数直接保留，即对0, 2, 4直接保留
        if (idx % 2 === 0) {
            return Number(item);
        }
        // 对 偶数位乘以2，若大于等于10，则减去9
        const tmp = Number(item) * 2;
        return tmp >= 10 ? tmp - 9 : tmp;
    })
    const total = sum(weighted);
    const result = (10 - (total % 10)) % 10;
    return result;
}

export const numberPadLeft = (n: number, length: number, padChar: string = '0') => {
    if (n < 0 || Math.floor(n) !== n) {
        throw new Error("待补零的数字必须是大于等于 0 的整数");
    }
    return (n+'').padStart(length, padChar);
}


export const luhn= (product: IProduct) => {
    const date = dayjs().format('YYMMDD');
    // // <YYMMDD><vendorId><productId><validationNumber>
    const {id, vendorId} = product;
    const tmp = `${date}${numberPadLeft(vendorId, 4)}${numberPadLeft(id, 4)}`
    const validationNumber = getValidationNumber(tmp);
    // console.log("validationNumber---:", validationNumber)
    return `${tmp}${validationNumber}`;
}