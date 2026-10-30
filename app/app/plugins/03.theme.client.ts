// 主题初始化插件：在首屏水合前把 localStorage 的主题写到 <html data-theme>，避免闪白
export default defineNuxtPlugin(() => {
    if (!import.meta.client) return;

    const stored = window.localStorage.getItem('nuxt-lab-theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    document.documentElement.dataset.theme = stored ?? (prefersLight ? 'light' : 'dark');
});
