// 产品类型定义
export interface IProduct {
	readonly id: number;
	name: string;
	img?: string;
	vendorId: number;
	remark?: string;
	balance: number;
	isDel: number;
	createdAt: Date;
	updatedAt: Date;
	price: number;
	cost: number;
}