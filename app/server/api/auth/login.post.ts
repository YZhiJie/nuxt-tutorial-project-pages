import type { LoginInput, LoginResponse } from '#shared/types/auth';

// 登录：演示账号 demo / nuxt1234，成功后写入 httpOnly cookie
export default defineEventHandler(async (event): Promise<LoginResponse> => {
    const body = await readBody<Partial<LoginInput>>(event);
    if (body?.username === 'demo' && body?.password === 'nuxt1234') {
        return { user: setAuthSession(event) };
    }
    throw createError({ statusCode: 401, message: '账号或密码错误' });
});
