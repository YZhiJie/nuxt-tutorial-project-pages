export default defineNuxtPlugin(() => {
    const isLoading = useState('route-loading', () => false);
    const router = useRouter();
    let timer: ReturnType<typeof setTimeout> | undefined;

    router.beforeEach((to, from) => {
        if (to.path === from.path) return;
        if (timer) clearTimeout(timer);
        isLoading.value = true;
    });

    router.afterEach(() => {
        if (timer) clearTimeout(timer);
        // 留一点时间让新页面完成首帧挂载，避免遮罩与新内容互相闪烁
        timer = setTimeout(() => {
            isLoading.value = false;
        }, 350);
    });
});
