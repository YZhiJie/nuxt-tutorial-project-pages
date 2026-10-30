interface Usage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

const ALLOWED_KEYS = ['title', 'summary', 'tags', 'risk'] as const;

function validate(input: unknown): string[] {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return ['结果必须是 JSON 对象'];
    }

    const record = input as Record<string, unknown>;
    const errors: string[] = [];

    const extra = Object.keys(record).filter(
        (key) => !ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number]),
    );
    if (extra.length) {
        errors.push(`包含未声明字段：${extra.join(', ')}`);
    }

    if (typeof record.title !== 'string' || !record.title.trim()) {
        errors.push('title 必须是非空字符串');
    } else if (record.title.length > 80) {
        errors.push('title 不能超过 80 个字符');
    }

    if (typeof record.summary !== 'string' || !record.summary.trim()) {
        errors.push('summary 必须是非空字符串');
    } else if (record.summary.length > 240) {
        errors.push('summary 不能超过 240 个字符');
    }

    if (!Array.isArray(record.tags)) {
        errors.push('tags 必须是字符串数组');
    } else {
        if (record.tags.length === 0) {
            errors.push('tags 至少需要 1 项');
        }
        if (record.tags.length > 8) {
            errors.push('tags 最多 8 项');
        }
        if (record.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
            errors.push('tags 中的每一项都必须是非空字符串');
        }
    }

    if (!['low', 'medium', 'high'].includes(record.risk as string)) {
        errors.push('risk 必须是 low / medium / high 之一');
    }

    return errors;
}

/**
 * 只修复「可安全纠正」的结构问题：丢字段、类型漂移、空白项。
 * risk 属于语义判断，不在这里静默改写，必须让校验失败暴露出来。
 */
function repair(input: Record<string, unknown>): Record<string, unknown> {
    const fixed: Record<string, unknown> = {};

    fixed.title =
        typeof input.title === 'string' && input.title.trim() ? input.title.trim() : '未命名结果';

    fixed.summary =
        typeof input.summary === 'string' && input.summary.trim()
            ? input.summary.trim()
            : '模型未返回摘要，已由服务端补齐。';

    let tags: string[] = [];
    if (Array.isArray(input.tags)) {
        tags = input.tags
            .filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim()))
            .map((tag) => tag.trim());
    } else if (typeof input.tags === 'string') {
        tags = input.tags
            .split(/[,，、]/)
            .map((tag) => tag.trim())
            .filter(Boolean);
    }
    fixed.tags = tags.length ? tags.slice(0, 8) : ['未分类'];

    // 保留原值，交给下一轮校验决定是否通过
    fixed.risk = input.risk;

    return fixed;
}

function mockGenerate(prompt: string): Record<string, unknown> {
    const dirty = /脏数据|dirty/i.test(prompt);
    const outOfRange = /越界|越权|critical/i.test(prompt);
    const titleBase = prompt.length > 18 ? `${prompt.slice(0, 18)}…` : prompt;

    return {
        title: dirty ? '' : `「${titleBase}」的结构化摘要`,
        summary: '模型把非结构化文本整理为固定字段，前端可以直接渲染，服务端也可以直接入库。',
        tags: dirty ? '性能, 缓存' : ['性能', '缓存'],
        risk: outOfRange ? 'critical' : 'medium',
        ...(dirty ? { notes: '这是 schema 之外的额外字段' } : {}),
    };
}

export default defineEventHandler(async (event) => {
    const body = await readBody<{ prompt?: unknown }>(event).catch(() => ({ prompt: undefined }));
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
        throw createError({ statusCode: 400, message: '请输入要结构化的文本' });
    }

    setResponseHeader(event, 'Cache-Control', 'no-store');

    const raw = mockGenerate(prompt);
    const initialErrors = validate(raw);

    let attempts = 1;
    let repaired = false;
    let candidate: Record<string, unknown> = raw;
    let errors = initialErrors;

    if (initialErrors.length) {
        attempts = 2;
        repaired = true;
        candidate = repair(raw);
        errors = validate(candidate);
    }

    const serialized = JSON.stringify(raw);
    const usage: Usage = {
        promptTokens: Math.ceil(prompt.length / 2),
        completionTokens: Math.ceil(serialized.length / 2),
        totalTokens: Math.ceil(prompt.length / 2) + Math.ceil(serialized.length / 2),
    };

    return {
        model: 'mock-structured-v1',
        attempts,
        repaired,
        ok: errors.length === 0,
        errors,
        data: candidate,
        raw,
        usage,
    };
});
