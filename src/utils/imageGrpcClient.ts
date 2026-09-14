/**
 * Python 商品图标准化服务（image_service）的 gRPC 客户端。
 *
 * 协议文件：proto/image_service.proto（与 image_service/proto/image_service.proto 同步）
 * 目标地址：IMAGE_GRPC_TARGET（默认 127.0.0.1:50051）
 */
import { join } from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const PROTO_PATH = join(import.meta.dir, "..", "..", "proto", "image_service.proto");
const TARGET = process.env.IMAGE_GRPC_TARGET || "127.0.0.1:50051";
// HTTP 上传限制为 20MB，gRPC 消息额外带 protobuf 帧，这里预留到 24MB
const MAX_MESSAGE_BYTES = 24 * 1024 * 1024;

export type ImageOutputFormat = "PNG" | "JPEG" | "WEBP";

export interface StandardizeOptions {
  /** AI 抠图（Python 端需 uv sync --extra rembg） */
  removeBackground?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  /** 方形补边 */
  square?: boolean;
  /** 背景色 #RRGGBB，默认 #FFFFFF */
  background?: string;
  outputFormat?: ImageOutputFormat;
  jpegQuality?: number;
}

export interface StandardizedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
  backgroundRemoved: boolean;
}

// ---- 懒加载单例（与 utils/prisma、utils/redis 同风格）----

interface StandardizeRequest {
  image: Buffer;
  options: {
    remove_background: boolean;
    max_width: number;
    max_height: number;
    square: boolean;
    background: string;
    output_format: string;
    jpeg_quality: number;
  };
}

interface StandardizeResponse {
  image: Buffer | Uint8Array;
  mime_type: string;
  width: number;
  height: number;
  original_size: number;
  processed_size: number;
  background_removed: boolean;
}

export class ImageGrpcError extends Error {
  constructor(
    readonly grpcCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ImageGrpcError";
  }
}

export function isInvalidImageArgumentError(err: unknown): err is ImageGrpcError {
  return err instanceof ImageGrpcError && err.grpcCode === grpc.status.INVALID_ARGUMENT;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any | null = null;

function getClient() {
  if (client) return client;

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    image: { v1: { ImageService: any } };
  };

  client = new proto.image.v1.ImageService(TARGET, grpc.credentials.createInsecure(), {
    "grpc.max_send_message_length": MAX_MESSAGE_BYTES,
    "grpc.max_receive_message_length": MAX_MESSAGE_BYTES,
  });
  return client;
}

/** gRPC 状态码 → 可读错误 */
function wrapGrpcError(err: unknown): ImageGrpcError {
  const e = err as { code?: number; details?: string; message?: string };
  const code = e.code ?? grpc.status.UNKNOWN;
  const codeName = grpc.status[code] ?? "UNKNOWN";
  return new ImageGrpcError(
    code,
    `图片服务调用失败(${codeName}): ${e.details || e.message || "未知错误"}`,
  );
}

/** 商品图标准化 */
export function standardizeImage(
  image: Buffer,
  options: StandardizeOptions = {},
): Promise<StandardizedImage> {
  const req: StandardizeRequest = {
    image,
    options: {
      remove_background: options.removeBackground ?? false,
      max_width: options.maxWidth ?? 0,
      max_height: options.maxHeight ?? 0,
      square: options.square ?? false,
      background: options.background ?? "#FFFFFF",
      output_format: options.outputFormat ?? "",
      jpeg_quality: options.jpegQuality ?? 90,
    },
  };

  return new Promise((resolve, reject) => {
    getClient().Standardize(req, (err: unknown, res: StandardizeResponse) => {
      if (err) return reject(wrapGrpcError(err));
      resolve({
        buffer: Buffer.from(res.image),
        mimeType: res.mime_type,
        width: res.width,
        height: res.height,
        originalSize: Number(res.original_size),
        processedSize: Number(res.processed_size),
        backgroundRemoved: res.background_removed,
      });
    });
  });
}

/** 健康检查（启动/部署时探活用） */
export function pingImageService(timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    getClient().Ping({}, { deadline: Date.now() + timeoutMs }, (err: unknown, res: { message: string }) => {
      if (err) return reject(wrapGrpcError(err));
      resolve(res.message);
    });
  });
}
