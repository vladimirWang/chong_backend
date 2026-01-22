import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt'
const { JWT_SECRET } = process.env;

export const authService = new Elysia({ name: 'Auth.Service' })
    .macro({
        isSignIn: {
            async resolve(ctx: Context) {                
                const { cookie, status, headers: {authorization}, jwt, request, url, route } = ctx;
                if (route.startsWith('/public')) {
                    console.log("命中")
                    return;
                }
                if (!authorization) return status(401)
                const user = await jwt.verify(authorization)
                console.log("authorization: ", route, Object.keys(request), url)

                if (!user) return status(401)

                return {
                    user
                }
            }
        }
    })