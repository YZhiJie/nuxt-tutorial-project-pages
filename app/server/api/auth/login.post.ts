import type { LoginInput, LoginResponse } from '#shared/types/auth';
import { authenticate } from '../../services/auth/auth-service';

// 登录：演示账号 demo / nuxt1234，成功后写入 httpOnly cookie。
// 400（入参缺失）与 401（账号密码错误）都走统一错误信封，不再手写裸 createError。
export default defineEventHandler(async (event): Promise<LoginResponse> => {
    try {
        const body = await readBody<Partial<LoginInput>>(event);
        authenticate(body);
        return { user: setAuthSession(event) };
    } catch (error) {
        throw toApiError(event, error);
    }
});
