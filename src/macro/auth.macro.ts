import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt'
const { JWT_SECRET } = process.env;

export const authService = new Elysia({ name: 'Auth.Service' })
    .macro({
        isSignIn: {
            async resolve(ctx: Context) {                
                console.log("inside auth macro: ")
                const { cookie, status, headers: {authorization}, jwt, request, url, route } = ctx;
                if (route.startsWith('/public')) {
                    console.log("public route: ", route)
                    return;
                }
                console.log("inside auth macro: authorization: ", authorization)
                if (!authorization) return status(401)
                const user = await jwt.verify(authorization)
                console.log("jwt verify result: ", user)

                if (!user) return status(401)

                return {
                    user
                }
            }
        }
    })