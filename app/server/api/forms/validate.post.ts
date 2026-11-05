interface ValidateBody {
    name?: unknown;
    email?: unknown;
    age?: unknown;
}

type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 手写校验：不依赖 zod，逐字段收敛为 { 字段: 错误文案 }
function validate(body: ValidateBody): FieldErrors {
    const errors: FieldErrors = {};

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
        errors.name = '姓名不能为空';
    } else if (name.length < 2 || name.length > 20) {
        errors.name = '姓名长度需在 2–20 个字符之间';
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
        errors.email = '邮箱不能为空';
    } else if (!EMAIL_RE.test(email)) {
        errors.email = '邮箱格式不正确';
    }

    const age = typeof body.age === 'number' ? body.age : Number(body.age);
    if (!Number.isInteger(age)) {
        errors.age = '年龄必须是整数';
    } else if (age < 18 || age > 120) {
        errors.age = '年龄需在 18–120 之间';
    }

    return errors;
}

// 服务端兜底校验：422 + 字段级错误，前端按 fields 精确标红
export default defineEventHandler(async (event) => {
    const body = (await readBody<ValidateBody>(event)) ?? {};
    const fields = validate(body);

    if (Object.keys(fields).length > 0) {
        throw createError({
            statusCode: 422,
            message: '表单校验未通过',
            data: { fields },
        });
    }

    return {
        ok: true,
        profile: {
            name: String(body.name).trim(),
            email: String(body.email).trim().toLowerCase(),
            age: Number(body.age),
        },
    };
});
