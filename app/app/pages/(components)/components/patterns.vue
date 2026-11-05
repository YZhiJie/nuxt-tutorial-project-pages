<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const CONTROLLED_CODE = `// 反例：内部状态与外部状态双写，父组件无法拦截或撤销
const open = ref(false);
function toggle() {
    open.value = !open.value;
    emit('change', open.value);
}

// 重构：受控组件只接收值、只发出意图
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

function requestToggle() {
    emit('update:open', !props.open);
}`;

const UNCONTROLLED_CODE = `// 非受控：组件内部持有状态，适合简单、无外部协调的场景
const open = ref(false);
function toggle() {
    open.value = !open.value;
}

// 受控：状态由父组件持有，适合需要校验、联动、持久化的场景
const props = defineProps<{ value: string }>();
const emit = defineEmits<{ 'update:value': [value: string] }>();

// 选择标准：父组件是否需要“知道并决定”每一次变更`;

const COMPOUND_CODE = `<!-- 反例：一个组件塞进十几个布尔 props -->
<DataTable
    :show-search="true"
    :show-filter="true"
    :show-pagination="true"
    :show-export="true"
    :compact="true"
/>

<!-- 重构：复合组件，结构由使用方声明 -->
<DataTable :rows="rows">
    <DataTable.Search />
    <DataTable.Filter />
    <DataTable.Rows />
    <DataTable.Pagination />
</DataTable>

<!-- 实现：父组件只负责共享上下文与布局 -->
<!-- DataTable.vue -->
<template>
    <div class="data-table">
        <slot />
    </div>
</template>`;

const RENDERLESS_CODE = `// renderless：只暴露状态与动作，渲染完全交给使用方
export function useDisclosure(initial = false) {
    const open = ref(initial);

    const show = () => { open.value = true; };
    const hide = () => { open.value = false; };
    const toggle = () => { open.value = !open.value; };

    return { open, show, hide, toggle };
}

// 同一个逻辑可以复用到弹窗、抽屉、折叠面板
const { open, toggle } = useDisclosure();
// <Modal v-model="open" />
// <Accordion :expanded="open" @toggle="toggle" />`;

const A11Y_CODE = `<!-- 默认值即最佳实践：语义标签、可访问名称、状态同步 -->
<button
    type="button"
    :aria-expanded="open"
    aria-controls="panel-id"
    @click="toggle"
>
    {{ open ? '收起详情' : '展开详情' }}
</button>

<div v-show="open" id="panel-id">
    <slot />
</div>

<!-- 反例：div 当按钮，没有键盘可达性，也没有状态语义 -->
<div class="btn" @click="toggle">展开详情</div>`;

const A11Y_RULES = [
    '优先使用原生语义元素：button、input、nav、ul，而不是 div + 点击事件。',
    '交互组件必须能键盘操作：Enter / Space 触发，Esc 关闭，焦点可见。',
    '图标按钮必须有 aria-label；展开 / 收起用 aria-expanded 表达状态。',
    '弹层打开时把焦点移入，关闭时归还给触发元素。',
];

const NAMING_CODE = `// props：名词化、可数、默认值明确
size?: 'sm' | 'md' | 'lg';
loading?: boolean;         // ✅
notReady?: boolean;        // ❌ 双重否定

// emits：过去式描述已发生的事实
saved: [payload: Entity];
submitted: [values: FormValues];
closed: [];

// slots：按位置与职责命名
// default / header / footer / actions / empty

// 组件名：业务域 + 名词，避免 Data / Item 这类泛化名
// ✅ DocPage、DemoProfileCard
// ❌ MyComponent、CommonBox`;

const decision = [
    { scene: '父组件需要校验 / 拦截每次变更', choice: '受控组件' },
    { scene: '简单表单、内部临时状态', choice: '非受控组件' },
    { scene: '配置项超过 5 个布尔 props', choice: '复合组件 / 插槽' },
    { scene: '只有逻辑、没有固定 UI', choice: 'renderless / composable' },
];
</script>

<template>
    <DocPage
        title="组件设计规范"
        description="可复用组件不是“参数越多越灵活”，而是契约清晰、状态归属明确、默认可访问。下面给出四组反例与重构方向。"
        :tags="['受控组件', '复合组件', 'renderless', 'a11y', 'API 命名']"
    >
        <DocSection id="controlled" title="受控与非受控" kicker="01 · CONTROLLED">
            <p class="body-text">
                受控组件的状态由父组件持有，子组件只发出变更意图；
                非受控组件自己持有状态，使用方无法介入每一次变更。
                选择标准只有一个：父组件是否需要“知道并决定”这次变化。
            </p>
            <CodeBlock :code="CONTROLLED_CODE" lang="ts" title="双写状态 → 受控组件" />
            <CodeBlock :code="UNCONTROLLED_CODE" lang="ts" title="两种模式的适用边界" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>场景</th><th>推荐</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in decision" :key="row.scene">
                            <td>{{ row.scene }}</td>
                            <td class="mono">{{ row.choice }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="compound" title="复合组件" kicker="02 · COMPOUND">
            <p class="body-text">
                当组件开始堆叠布尔 props 来表达布局，说明它承担了太多结构决策。
                复合组件把结构交给使用方，父组件只负责共享上下文与样式约束。
            </p>
            <CodeBlock :code="COMPOUND_CODE" lang="vue" title="布尔开关 → 复合组件" />
            <Callout type="tip" title="复合组件的代价">
                结构更灵活，但使用方需要理解子组件顺序与上下文。
                只对真正复杂的组件（表格、表单、菜单）使用，不要为简单卡片引入复合 API。
            </Callout>
        </DocSection>

        <DocSection id="renderless" title="Renderless 与逻辑复用" kicker="03 · RENDERLESS">
            <p class="body-text">
                当多份 UI 共享同一套状态机（展开、分页、选择），把逻辑抽成 composable，
                渲染交给各使用方。这样既不绑定 DOM 结构，也便于单独测试。
            </p>
            <CodeBlock :code="RENDERLESS_CODE" lang="ts" title="只暴露状态与动作" />
        </DocSection>

        <DocSection id="a11y" title="可访问性默认值" kicker="04 · A11Y">
            <p class="body-text">
                可访问性不应该由使用方逐个补齐。组件应当默认输出正确的语义、
                可访问名称与键盘行为，使用方无需额外配置就能安全使用。
            </p>
            <CodeBlock :code="A11Y_CODE" lang="vue" title="语义元素 + 状态同步" />
            <ul class="checklist">
                <li v-for="item in A11Y_RULES" :key="item">{{ item }}</li>
            </ul>
        </DocSection>

        <DocSection id="naming" title="API 命名" kicker="05 · NAMING">
            <p class="body-text">
                命名是组件契约的一部分。布尔值用肯定式，事件用过去式，
                插槽描述位置，组件名带业务语义。命名一致，团队才能猜对用法。
            </p>
            <CodeBlock :code="NAMING_CODE" lang="ts" title="命名对照" />
            <Callout type="warn" title="避免泛化命名">
                <code>Data</code>、<code>Item</code>、<code>Common</code> 这类名字无法表达职责，
                最终会演变成什么都装一点的“上帝组件”。
            </Callout>
        </DocSection>
    </DocPage>
</template>

<style scoped>
.body-text {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-muted);
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
}

.checklist li {
    position: relative;
    padding-left: 24px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}
</style>
