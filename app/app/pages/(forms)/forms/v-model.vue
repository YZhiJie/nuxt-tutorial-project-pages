<script setup lang="ts">
definePageMeta({ layout: 'docs' });

interface ProductForm {
    sku: string;
    name: string;
    price: number;
    stock: number;
    tags: string;
}

const initial: ProductForm = {
    sku: '',
    name: '',
    price: 0,
    stock: 0,
    tags: '',
};

const form = reactive<ProductForm>({ ...initial });

// 脏值：与初始快照比较；扁平对象用 JSON 比较足够直接
const dirty = computed(
    () => JSON.stringify(form) !== JSON.stringify(initial),
);

const tagList = computed(() =>
    form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
);

const totalValue = computed(() => form.price * form.stock);

const completion = computed(() => {
    const filled = [
        form.sku.trim().length > 0,
        form.name.trim().length > 0,
        form.price > 0,
        form.stock > 0,
    ].filter(Boolean).length;
    return Math.round((filled / 4) * 100);
});

const preview = computed(() => JSON.stringify(form, null, 2));

function reset() {
    Object.assign(form, initial);
}

const ESSENCE = `<!-- v-model 是 :value + @input 的语法糖 -->
<input :value="form.name" @input="form.name = $event.target.value" />
<input v-model="form.name" />

<!-- 自定义组件：约定 modelValue / update:modelValue -->
<MyInput v-model="form.name" />
<!-- 等价于 -->
<MyInput
    :model-value="form.name"
    @update:model-value="form.name = $event"
/>`;

const MODIFIERS = `<!-- .trim：自动去掉首尾空白 -->
<input v-model.trim="form.name" placeholder="商品名称" />

<!-- .number：把输入值转成数字（空值得到 ''，无法解析时保留原值） -->
<input v-model.number="form.price" type="number" min="0" step="0.01" />

<!-- 组合使用：Vue 按声明顺序应用修饰符 -->
<input v-model.trim.number="form.sku" />`;

const DIRTY = `const initial = { sku: '', name: '', price: 0, stock: 0 };

const form = reactive({ ...initial });

const dirty = computed(
    () => JSON.stringify(form) !== JSON.stringify(initial),
);

function reset() {
    Object.assign(form, initial);
}

// 嵌套对象要深拷贝快照，否则 initial 会被引用修改
// const initial = structuredClone(deepForm);`;

const DERIVED = `// 派生值只读，永远从源数据计算，不单独维护
const tagList = computed(() =>
    form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
);

const totalValue = computed(() => form.price * form.stock);

const completion = computed(() => {
    const filled = [
        form.sku.trim() !== '',
        form.name.trim() !== '',
        form.price > 0,
        form.stock > 0,
    ].filter(Boolean).length;
    return Math.round((filled / 4) * 100);
});`;
</script>

<template>
    <DocPage
        title="v-model 与表单建模"
        description="v-model 负责把输入与数据连起来，但表单的可靠性来自建模：单一对象、明确类型、可比较快照与只读派生值。"
        :tags="['v-model', '修饰符', '脏值', '重置', '派生值']"
    >
        <DocSection id="essence" title="v-model 的本质" kicker="01 · ESSENCE">
            <p class="body-text">
                在原生输入框上，<code>v-model</code> 是
                <code>:value</code> 加 <code>@input</code> 的语法糖；
                在自定义组件上，它约定 <code>modelValue</code> 与
                <code>update:modelValue</code> 两个契约。理解这层等价关系，
                才能在需要格式化、节流或受控输入时正确拆开使用。
            </p>
            <CodeBlock :code="ESSENCE" lang="vue" title="语法糖与组件契约" />
            <Callout type="info" title="多字段用对象，不用散装 ref">
                字段超过三个就应收敛为对象。对象便于快照比较、批量重置、
                统一提交，也能直接复用共享类型。
            </Callout>
        </DocSection>

        <DocSection id="modifiers" title="修饰符：trim 与 number" kicker="02 · MODIFIERS">
            <p class="body-text">
                <code>.trim</code> 去掉首尾空白，适合名称、邮箱、SKU 这类文本；
                <code>.number</code> 把输入转成数字，但空输入会得到空字符串，
                无法解析的内容会保留原值。因此“数字字段”仍应在提交前
                用 <code>Number.isInteger</code> 或范围校验兜底。
            </p>
            <CodeBlock :code="MODIFIERS" lang="vue" title="常用修饰符" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>修饰符</th><th>行为</th><th>注意点</th></tr>
                    </thead>
                    <tbody>
                        <tr><td class="mono">.trim</td><td>自动去除首尾空白</td><td>不适合需要保留空白的富文本</td></tr>
                        <tr><td class="mono">.number</td><td>尝试转成数字</td><td>空值为 ''，无法解析时保留原值</td></tr>
                        <tr><td class="mono">.lazy</td><td>改为 change 时同步</td><td>减少高频输入带来的计算</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="dirty" title="脏值与重置" kicker="03 · DIRTY">
            <p class="body-text">
                “有没有未保存的修改”是可计算出来的，不需要额外维护一个布尔值。
                保存一份初始快照，把当前表单序列化后与之比较即可。
                重置就是恢复快照，注意嵌套对象必须深拷贝，避免快照被引用修改。
            </p>
            <CodeBlock :code="DIRTY" lang="ts" title="快照比较与重置" />
            <Callout type="warn" title="离开页面前的提醒">
                路由跳转或刷新前若 <code>dirty</code> 为真，应弹出确认。
                这属于体验保护，不是数据安全，真正的数据一致性仍由服务端保证。
            </Callout>
        </DocSection>

        <DocSection id="derived" title="派生值与实时预览" kicker="04 · DERIVED">
            <p class="body-text">
                标签列表、总货值、完成度都属于派生值：只从源字段计算，不单独存一份，
                否则迟早出现“改了价格但总价没更新”的同步 bug。
            </p>
            <CodeBlock :code="DERIVED" lang="ts" title="只读派生值" />

            <DemoCard
                title="商品表单实时预览"
                desc="修改字段观察脏值、派生值与表单对象 JSON；重置后回到初始快照。"
            >
                <div class="form-grid">
                    <label class="field">
                        <span>SKU（.trim）</span>
                        <input v-model.trim="form.sku" class="input" placeholder="如 NX-1001" />
                    </label>
                    <label class="field">
                        <span>商品名称（.trim）</span>
                        <input v-model.trim="form.name" class="input" placeholder="如 Nuxt 实战手册" />
                    </label>
                    <label class="field">
                        <span>单价（.number）</span>
                        <input v-model.number="form.price" class="input" type="number" min="0" step="0.01" />
                    </label>
                    <label class="field">
                        <span>库存（.number）</span>
                        <input v-model.number="form.stock" class="input" type="number" min="0" step="1" />
                    </label>
                    <label class="field field--wide">
                        <span>标签（逗号分隔，自动 trim 与去空）</span>
                        <input v-model="form.tags" class="input" placeholder="nuxt, 前端, 教程" />
                    </label>
                </div>

                <div class="metrics">
                    <span class="metric">
                        脏值
                        <b :class="dirty ? 'is-dirty' : 'is-clean'">{{ dirty ? '已修改' : '未修改' }}</b>
                    </span>
                    <span class="metric">总货值 <b>{{ totalValue.toFixed(2) }}</b></span>
                    <span class="metric">完成度 <b>{{ completion }}%</b></span>
                    <span class="metric">标签数 <b>{{ tagList.length }}</b></span>
                </div>

                <div class="json-row">
                    <div class="json-head">
                        <span class="mono">form 对象</span>
                        <button type="button" class="btn btn--ghost btn--sm" :disabled="!dirty" @click="reset">
                            重置
                        </button>
                    </div>
                    <pre class="json">{{ preview }}</pre>
                </div>

                <template #footer>
                    提示：把单价清空，<code>.number</code> 会得到空字符串，JSON 中显示为 <code>""</code>；这正是需要在提交前校验的原因。
                </template>
            </DemoCard>
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

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
}

.field--wide {
    grid-column: 1 / -1;
}

.metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 18px 0 14px;
}

.metric {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 12px;
    color: var(--text-muted);
}

.metric b {
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
}

.is-dirty {
    color: var(--warn) !important;
}

.is-clean {
    color: var(--accent) !important;
}

.json-row {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--bg-elevated);
}

.json-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    font-size: 11px;
    color: var(--text-faint);
}

.json {
    margin: 0;
    border: none;
    border-radius: 0;
    font-size: 12.5px;
    max-height: 260px;
    overflow: auto;
}

@media (max-width: 560px) {
    .form-grid {
        grid-template-columns: 1fr;
    }
}
</style>
