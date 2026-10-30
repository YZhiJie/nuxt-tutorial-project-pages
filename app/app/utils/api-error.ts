// 纯函数：把 $fetch 错误归一成可展示的提示文案
export function getApiErrorMessage(error: unknown, fallback = '请求失败，请稍后重试'): string {
    if (typeof error === 'object' && error !== null) {
        const e = error as {
            data?: { statusMessage?: string; message?: string };
            statusMessage?: string;
            message?: string;
        };
        return (
            e.data?.message ??
            e.data?.statusMessage ??
            e.message ??
            e.statusMessage ??
            fallback
        );
    }
    return fallback;
}
