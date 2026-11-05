// 跨组件共享的计数器：useState 保证 SSR 状态同构
export function useCounter() {
    const count = useState('playground-counter', () => 0);

    const increment = () => {
        count.value += 1;
    };
    const decrement = () => {
        count.value -= 1;
    };
    const reset = () => {
        count.value = 0;
    };

    return { count, increment, decrement, reset };
}
