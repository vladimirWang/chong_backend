import { errorCode, ErrorResponse, SuccessResponse } from "../models/Response";

export const loginUser = async ({ body, jwt }) => {
    const userExisted = await prisma.user.findFirst({
        where: {
            email: body.email,
            password: body.password
        }
    })
    if (!userExisted) {
        const result = new ErrorResponse(errorCode.USER_NOT_FOUND, "用户不存在");
        return JSON.stringify(result);
    }
    // 生成 token
    const token = await jwt.sign({
        userId: userExisted.id,
        username: userExisted.username,
    });

    return JSON.stringify(new SuccessResponse<string>(token, "用户登录成功"));
}

export const registerUser = async ({ body }) => {
    // console.log("register body: ", prisma.user)
    // return {code: '1'}
    const user = await prisma.user.create({
        data: {
            email: body.email,
            password: body.password
        },
        // select: [
        //     'id',
        //     "email",
        //     "username",
        //     "createdAt"
        // ]
    });

    const userCreated = {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt
    }
    const result = new SuccessResponse(userCreated, "用户创建成功");
    return JSON.stringify(result);
}