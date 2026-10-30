<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const PROXY_CODE = `// server/api/ai/stream.post.ts —— 浏览器只调用自己的接口
export default defineEventHandler(async (event) => {
    const { prompt } = await readBody(event);

    // 1. 鉴权与配额：先确认是谁、还能不能用
    await requireUser(event);
    await consumeQuota(event);

    // 2. 密钥只存在于服务端运行时配置
    const apiKey = useRuntimeConfig().aiApiKey;

    // 3. 调用上游，流式转交
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            stream: true,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    // 4. 同时记录用量、模型与首字节延迟
    return proxyStream(upstream.body);
});`;

const SHAPE_CODE = `// 形态 A：流式文本，首字节尽快到达
// 适合聊天、摘要、代码生成
const response = await fetch('/api/ai/stream', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
});
const reader = response.body?.getReader();
// 循环读取并逐段渲染

// 形态 B：结构化 JSON，一次性校验后再渲染
// 适合表单填充、分类、工单字段抽取
const result = await $fetch('/api/ai/structured', {
    method: 'POST',
    body: { prompt },
});
if (!result.ok) showErrors(result.errors);`;

const RAG_CODE = `// RAG 的四个阶段
// 1. 分块：按语义 / 标题切分，块大小 300–800 tokens，保留来源与位置
// 2. 向量化：embedding 模型把块转成向量，写入向量索引
// 3. 召回：查询向量 topK 20，再重排到 top 5
// 4. 生成：把命中的块作为引用材料放入提示词，要求模型标注来源

// 最低可用的评估指标
// - Recall@K：正确片段是否出现在召回集合中
// - 引用准确率：回答中的引用是否真的支持结论
// - 拒答率：材料不足时是否承认不知道`;

const COST_CODE = `// 成本控制的三道闸门
// 1. 请求前：按用户 / 租户限流，限制最大输入长度
// 2. 请求中：设置超时与最大输出 token，避免无限生成
// 3. 请求后：记录 token 用量、模型、耗时与失败原因

// 不要把密钥放到 public runtimeConfig：它会随构建产物下发到浏览器
const config = useRuntimeConfig();
const apiKey = config.aiApiKey;   // 仅服务端可见

// 失败要降级：超时返回缓存答案或明确提示，而不是让页面一直转圈`;

const shapeRows = [
    { need: '聊天 / 解释', shape: '流式文本', why: '首字尽快出现，用户能感知进度' },
    { need: '摘要 / 长文生成', shape: '流式文本', why: '生成耗时长，流式能显著降低焦虑' },
    { need: '分类 / 字段抽取', shape: '结构化 JSON', why: '下游要直接入库或渲染表单' },
    { need: '多步工具调用', shape: '结构化 + 状态机', why: '每一步的入参与结果都要可校验' },
    { need: '批量离线处理', shape: '异步任务 + 轮询', why: '不适合占用长连接' },
];

const costRows = [
    { gate: '输入长度', action: '限制 prompt 与上下文 token', effect: '防止单次请求成本失控' },
    { gate: '输出长度', action: '设置 max_tokens 与超时', effect: '避免无限生成与挂起' },
    { gate: '模型选择', action: '按任务分级：小模型做分类，大模型做生成', effect: '显著降低平均单价' },
    { gate: '缓存', action: '相同问题短时缓存结果', effect: '削减重复调用' },
    { gate: '限流', action: '按用户 / 租户配额', effect: '防止脚本刷爆账单' },
];

const notes = [
    '密钥只能存在于服务端：public runtimeConfig 会进入浏览器产物，等同于公开。',
    '不要把模型的原始错误直接返回给用户：其中可能包含上游地址、配额与内部提示词。',
    '提示词注入是输入问题，不是模型问题：检索内容与用户输入都要与系统指令隔离。',
    '所有模型输出都要经过校验再使用；结构化输出不能替代 schema 校验。',
    '记录 requestId、模型、token 用量与耗时，否则无法定位「哪类请求最贵」。',
];
</script>

<template>
    <DocPage
        title="AI 集成"
        description="把模型放进产品，难点不在调用 API，而在密钥隔离、流式体验、结构化校验、检索质量与成本控制。本模块按这五件事组织。"
        :tags="['服务端代理', '流式响应', '结构化输出', 'RAG', '成本控制']"
    >
        <DocSection id="proxy" title="服务端代理与密钥隔离" kicker="01 · PROXY">
            <p class="body-text">
                浏览器永远不应该直连模型服务。直连意味着密钥暴露、配额被刷、内容审核缺失，
                也无法把用户身份与用量关联起来。正确形态是：浏览器只调用自己的 Nitro 接口，
                由服务端完成鉴权、配额、提示词拼装与上游调用。
            </p>
            <CodeBlock :code="PROXY_CODE" lang="ts" title="服务端代理的最小骨架" />
            <Callout type="danger" title="public 配置不等于安全">
                写在 <code>runtimeConfig.public</code> 里的值会进入浏览器产物。
                任何密钥、内部地址、上游账号都必须放在非 public 的运行时配置中。
            </Callout>
        </DocSection>

        <DocSection id="shape" title="流式还是结构化" kicker="02 · SHAPE">
            <p class="body-text">
                选择响应形态的标准不是「哪个更先进」，而是<strong>下游怎么消费</strong>。
                给人看的内容适合流式；给程序用的内容适合结构化 JSON。
                两者可以组合：先流式展示，结束后再返回一份结构化结果。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>需求</th><th>推荐形态</th><th>原因</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in shapeRows" :key="row.need">
                            <td>{{ row.need }}</td>
                            <td>{{ row.shape }}</td>
                            <td>{{ row.why }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="SHAPE_CODE" lang="ts" title="两种调用方式" />
        </DocSection>

        <DocSection id="rag" title="RAG：先检索，再生成" kicker="03 · RAG">
            <p class="body-text">
                模型不知道你的私有文档。RAG 把文档切块、向量化、按问题召回，
                再把命中的片段放进提示词。它的质量上限由<strong>召回</strong>决定：
                如果正确片段根本没被检索到，再强的模型也只能编造。
            </p>
            <CodeBlock :code="RAG_CODE" lang="text" title="RAG 流水线与评估指标" />
        </DocSection>

        <DocSection id="cost" title="成本、限流与可观测" kicker="04 · COST">
            <p class="body-text">
                模型调用是可变成本：同一段代码，输入长度、输出长度与模型档位都能让账单差一个数量级。
                因此要像对待数据库查询一样对待模型调用：有限流、有超时、有降级、有用量记录。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>闸门</th><th>做法</th><th>效果</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in costRows" :key="row.gate">
                            <td>{{ row.gate }}</td>
                            <td>{{ row.action }}</td>
                            <td>{{ row.effect }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="COST_CODE" lang="ts" title="成本控制与密钥位置" />
            <ul class="checklist">
                <li v-for="item in notes" :key="item">{{ item }}</li>
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

.body-text strong {
    color: var(--text);
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
    line-height: 1.7;
    color: var(--text-muted);
}

.checklist li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-family: var(--font-mono);
}
</style>
