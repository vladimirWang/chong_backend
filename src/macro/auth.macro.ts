import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt'
const { JWT_SECRET } = process.env;

// 1. 创建 Elysia 插件，用于承载鉴权 macro
export const authPlugin = new Elysia({ name: 'auth-plugin' })
  // 2. 定义鉴权 macro，命名为 `auth`（可自定义名称）
  .macro({
    // macro 函数：无额外参数（如需扩展权限分级，可添加参数）
    auth: () => ({
      // 3. 核心：beforeHandle 钩子（路由处理前执行鉴权）
      beforeHandle: async ({ headers, set, jwt, status }) => {
        // 步骤 1：提取请求头中的 Authorization 信息
        const authorization = headers.authorization;
        console.log("-----token 0: ", authorization)
        if (!authorization) {
          // 无认证信息：设置 401 状态码，返回错误信息
          set.status = 401;
          set.headers['WWW-Authenticate'] = 'Bearer';
          return { success: false, message: '未提供认证 Token' };
        }
        // console.log("-----token 1", jwt)
        const profile = await jwt.verify(authorization)

        if (!profile){
            return status(401, '1Unauthorized: Invalid token')
        }
        // // 步骤 2：解析 Bearer Token（格式：Bearer <token>）
        // const [bearer, token] = authorization.split(' ');
        // if (bearer !== 'Bearer' || !token) {
        //   set.status = 401;
        //   return { success: false, message: 'Token 格式错误，应为 Bearer <token>' };
        // }

        // // 步骤 3：验证 Token 有效性（此处为模拟验证，实际项目替换为 JWT/数据库验证）
        // const validToken = 'your-valid-secret-token'; // 真实场景替换为 JWT verify 等逻辑
        // if (token !== validToken) {
        //   set.status = 401;
        //   return { success: false, message: '无效或过期的 Token' };
        // }

        // 步骤 4：鉴权通过，无返回值（自动放行至路由处理器）
        console.log('鉴权通过，允许访问受保护路由');
      }
    })
  });
