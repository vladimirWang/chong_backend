import {
  standardizeImage,
  type ImageOutputFormat,
  type StandardizedImage,
} from "../../utils/imageGrpcClient";

export interface StandardizeProductImageParams {
  removeBackground?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  square?: boolean;
  background?: string;
  outputFormat?: ImageOutputFormat;
  jpegQuality?: number;
}

/** 调 Python image_service 做商品图标准化 */
export async function standardizeProductImage(
  buffer: Buffer,
  params: StandardizeProductImageParams,
): Promise<StandardizedImage> {
  return standardizeImage(buffer, params);
}
