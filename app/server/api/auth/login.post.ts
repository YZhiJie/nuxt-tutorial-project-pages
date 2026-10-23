// 登录：演示账号 demo / nuxt1234，成功后写入 httpOnly cookie
export default defineEventHandler(async (event) => {
    const body = await readBody<{ username?: string; password?: string }>(event);
    if (body?.username === 'demo' && body?.password === 'nuxt1234') {
        setCookie(event, 'session', 'demo-token', {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24,
        });
        return { user: { name: 'demo' } };
    }
    throw createError({ statusCode: 401, statusMessage: '账号或密码错误' });
});
