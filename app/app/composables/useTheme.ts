// 全站主题状态：dark / light，默认跟随系统偏好并持久化到 localStorage
export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'nuxt-lab-theme';

export function useTheme() {
    // useState 让 SSR 与客户端共享同一份状态，避免水合不一致
    const theme = useState<ThemeMode>('theme-mode', () => 'dark');
    const ready = useState('theme-ready', () => false);

    // 首次挂载：读取本地存储 / 系统偏好，并写入 <html data-theme>
    function applyInitial() {
        if (!import.meta.client || ready.value) return;
        const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        theme.value = stored ?? (prefersLight ? 'light' : 'dark');
        document.documentElement.dataset.theme = theme.value;
        ready.value = true;
    }

    function apply(mode: ThemeMode) {
        if (!import.meta.client) return;
        document.documentElement.dataset.theme = mode;
        window.localStorage.setItem(STORAGE_KEY, mode);
    }

    function toggle() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        apply(theme.value);
    }

    function set(mode: ThemeMode) {
        theme.value = mode;
        apply(mode);
    }

    onMounted(applyInitial);

    return { theme, ready, toggle, set };
}
