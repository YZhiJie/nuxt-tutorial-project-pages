type ApiErrorLike = {
    data?: {
        error?: { code?: string; message?: string };
        statusMessage?: string;
        message?: string;
    };
    statusMessage?: string;
    message?: string;
};

function asApiErrorLike(error: unknown): ApiErrorLike | null {
    return typeof error === 'object' && error !== null ? (error as ApiErrorLike) : null;
}

// 纯函数：把 $fetch 错误归一成可展示的提示文案
export function getApiErrorMessage(error: unknown, fallback = '请求失败，请稍后重试'): string {
    const e = asApiErrorLike(error);
    if (!e) return fallback;
    return (
        e.data?.error?.message ??
        e.data?.message ??
        e.data?.statusMessage ??
        e.message ??
        e.statusMessage ??
        fallback
    );
}

// 纯函数：优先返回服务端错误码，便于前端做分支处理（如 404 显示空状态）
export function getApiErrorCode(error: unknown): string | null {
    return asApiErrorLike(error)?.data?.error?.code ?? null;
}
