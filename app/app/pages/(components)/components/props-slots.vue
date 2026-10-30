<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const following = ref(false);
const followLog = ref<string[]>([]);

function onFollow(name: string) {
    const at = new Date().toLocaleTimeString('zh-CN');
    followLog.value = [`${name} 收到关注通知 · ${at}`, ...followLog.value].slice(0, 4);
}

const COMPONENT_CODE = `<!-- app/components/demo/DemoProfileCard.vue -->
<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        name: string;
        role?: string;
        modelValue?: boolean;
    }>(),
    { role: '团队成员', modelValue: false },
);

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    follow: [name: string];
}>();
<\/script>

<template>
    <div class="profile-card">
        <slot />
        <slot name="stats" :followers="1286" :posts="24" :joined="'2024-03'" />
        <slot name="footer" :name="name" />
    </div>
</template>`;

const MODEL_CODE = `// 子组件：只发意图，不持有真相
const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

function toggle() {
    emit('update:modelValue', !props.modelValue);
}

// 父组件：v-model 一行完成读写
const following = ref(false);

<DemoProfileCard v-model="following" name="林野" role="前端工程师" />`;

const SLOT_CODE = `<DemoProfileCard
    v-model="following"
    name="林野"
    role="前端工程师"
    @follow="onFollow"
>
    <p>默认插槽：卡片主体描述，由使用方决定内容。</p>

    <template #stats="{ followers, posts, joined }">
        <span>{{ followers }} 关注 · {{ posts }} 篇文章 · {{ joined }} 加入</span>
    </template>

    <template #footer="{ name }">
        <span>具名 + 作用域：{{ name }} 的个人主页</span>
    </template>
</DemoProfileCard>`;

const NAMING_CODE = `// props：名词、可数、带默认值
defineProps<{
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
}>();

// emits：过去式描述已发生的事实
defineEmits<{
    submitted: [payload: FormPayload];
    closed: [];
}>();

// slots：按位置与职责命名
// default / header / footer / actions / empty`;

const rules = [
    'props 使用可选类型 + withDefaults，避免使用方必须传无关字段。',
    'v-model 只绑定一个核心值；多个字段优先使用多个具名 prop 与事件。',
    '作用域插槽暴露的数据保持最小集合，不要把内部实现细节全部抛出去。',
    '默认插槽必须有合理空状态，避免不传内容时布局塌陷。',
];
</script>

<template>
    <DocPage
        title="Props / Emits / Slots"
        description="用一个真实的 Profile 卡片演示完整的组件契约：类型化 props、v-model 双向绑定、默认 / 具名 / 作用域插槽。"
        :tags="['defineProps', 'defineEmits', 'v-model', '作用域插槽', 'DemoProfileCard']"
    >
        <DocSection id="props" title="类型化 Props" kicker="01 · PROPS">
            <p class="body-text">
                <code>DemoProfileCard</code> 接收 <code>name</code>（必填）、
                <code>role</code>（默认值）与 <code>modelValue</code>（v-model 绑定值）。
                默认值用 <code>withDefaults</code> 声明，调用方只传关心的字段。
            </p>
            <CodeBlock :code="COMPONENT_CODE" lang="vue" title="组件契约骨架" />
            <Callout type="tip" title="props 是只读的">
                子组件不要直接修改 <code>props.name</code> 或 <code>props.modelValue</code>。
                需要变更时发出事件，让父组件决定是否接受。
            </Callout>
        </DocSection>

        <DocSection id="model" title="v-model 双向绑定" kicker="02 · V-MODEL">
            <p class="body-text">
                卡片右上角的「关注 / 已关注」按钮通过
                <code>update:modelValue</code> 把新值交给父组件。
                <code>following</code> 始终是唯一事实来源，子组件不保存副本。
            </p>
            <CodeBlock :code="MODEL_CODE" lang="vue" title="受控组件的最小实现" />
            <DemoCard title="v-model：关注状态" desc="点击按钮切换 following；状态变化会同步到卡片样式。" badge="LIVE">
                <DemoProfileCard
                    v-model="following"
                    name="林野"
                    role="前端工程师"
                    @follow="onFollow"
                >
                    <p>默认插槽：负责数据可视化与设计系统，偏好把复杂交互拆成小组件。</p>

                    <template #stats="{ followers, posts, joined }">
                        <span>{{ followers }} 关注 · {{ posts }} 篇文章 · {{ joined }} 加入</span>
                    </template>

                    <template #footer="{ name }">
                        <span>footer 具名插槽：{{ name }} 的个人主页 →</span>
                    </template>
                </DemoProfileCard>

                <div class="model-state">
                    <span class="badge" :class="following ? 'badge--accent' : ''">
                        following = {{ following }}
                    </span>
                    <button type="button" class="btn btn--ghost btn--sm" @click="following = !following">
                        父组件直接切换
                    </button>
                </div>
            </DemoCard>
        </DocSection>

        <DocSection id="slots" title="三种插槽" kicker="03 · SLOTS">
            <p class="body-text">
                默认插槽放主体描述，<code>#stats</code> 是作用域插槽（拿到关注数、文章数、加入时间），
                <code>#footer</code> 是具名插槽（拿到 name）。三者组合，组件结构由使用方决定。
            </p>
            <CodeBlock :code="SLOT_CODE" lang="vue" title="使用方视角" />
            <CodeBlock :code="NAMING_CODE" lang="ts" title="API 命名约定" />
            <div v-if="followLog.length" class="event-log">
                <p class="event-log-title">emit('follow') 事件记录</p>
                <ul>
                    <li v-for="item in followLog" :key="item" class="mono">{{ item }}</li>
                </ul>
            </div>
        </DocSection>

        <DocSection id="rules" title="组件 API 规范" kicker="04 · RULES">
            <ul class="checklist">
                <li v-for="item in rules" :key="item">{{ item }}</li>
            </ul>
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

.model-state {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
}

.event-log {
    margin-top: 14px;
    padding: 12px 14px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.event-log-title {
    margin: 0 0 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
}

.event-log ul {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.event-log li {
    font-size: 11px;
    color: var(--text-muted);
}

.checklist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
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
