// Options 风格 store
export const useCounterStore = defineStore('counter', {
    state: () => ({ count: 0 }),
    getters: {
        // 双倍计数
        double: (state) => state.count * 2,
    },
    actions: {
        increment() {
            this.count += 1;
        },
    },
});
