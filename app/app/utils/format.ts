// 纯函数工具：不依赖任何 Nuxt API，vitest 可直接 import 单测
export function formatDate(iso: string): string {
    const date = new Date(iso);
    // 非法输入兜底：原样返回
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}
