<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const CHUNK_CODE = `// 分块目标：每块既能独立表达语义，又足够短以便召回
interface Chunk {
    id: string;
    docId: string;
    heading: string;       // 所属标题，用于构造引用
    text: string;          // 300–800 tokens
    startOffset: number;   // 在原文中的位置，用于回链
}

// 推荐顺序：先按标题切，再按段落 / 句子切
// 不要按固定字符数硬切：会把表格、代码块与上下文切断

// 每块都要保留元数据
// docId / title / url / updatedAt / headingPath / chunkIndex`;

const RETRIEVE_CODE = `// 查询侧：问题与文档块必须使用同一个 embedding 模型
const queryVector = await embed(question);

// 向量检索：topK 取宽一些，给重排留空间
const candidates = await vectorStore.search(queryVector, { topK: 20 });

// 重排：用 cross-encoder 或轻量模型给候选打分
const reranked = await rerank(question, candidates, { topN: 5 });

// 生成：把片段装进提示词，并要求标注引用编号
const context = reranked
    .map((item, index) => '[引用 ' + (index + 1) + '] ' + item.text)
    .join('\\n\\n');`;

const CITE_CODE = `// 提示词要求模型只根据材料回答，并标注引用编号
const system = [
    '你只能使用提供的资料回答。',
    '每个结论后必须标注 [引用 n]。',
    '资料不足时说「资料中未提及」，不要推测。',
].join('\\n');

// 输出后抽取引用编号，再回查真实片段
const cited = [...answer.matchAll(/\\[引用 (\\d+)\\]/g)].map((match) => Number(match[1]));
const valid = cited.every((index) => reranked[index - 1]);
if (!valid) reject('引用不存在');`;

const EVAL_CODE = `// 离线评估集：问题 + 应命中的片段 id
const cases = [
    { question: '退款多久到账？', expectedChunkIds: ['refund-3'] },
];

// Recall@K：应命中的片段是否出现在前 K 个召回结果里
const recall = cases.filter((item) => {
    const topK = retrieved.get(item.question);
    return item.expectedChunkIds.every((id) => topK.includes(id));
}).length / cases.length;

// 幻觉率：回答中的每个结论是否都能被引用片段支持
// 用人工抽检或第二个模型做 judge，不要只看语言流畅度`;

const chunkRows = [
    { method: '固定长度', pros: '实现简单、块大小均匀', cons: '会切断语义与表格', fit: '原型与快速验证' },
    { method: '按标题', pros: '保留文档结构', cons: '长章节仍然过大', fit: '手册、规范、技术文档' },
    { method: '按段落', pros: '语义完整、边界自然', cons: '颗粒度不一致', fit: '博客、帮助中心' },
    { method: '按问答对', pros: '命中率高', cons: '依赖已有标注', fit: 'FAQ、客服知识库' },
    { method: '父子块', pros: '召回子块、返回父块', cons: '实现与存储更复杂', fit: '长文档问答' },
];

const evalRows = [
    { metric: 'Recall@5', definition: '正确片段是否进入前 5 个召回结果', target: '≥ 0.90', failure: '检索没找到，生成必然出错' },
    { metric: '引用准确率', definition: '结论是否有真实引用片段支持', target: '≥ 0.95', failure: '模型在编造来源' },
    { metric: '幻觉率', definition: '无材料支持的结论占比', target: '≤ 2%', failure: '提示词或相关性阈值需收紧' },
    { metric: '拒答率', definition: '材料不足时明确承认不知道', target: '按业务定义', failure: '过低说明模型在硬答' },
    { metric: 'P95 延迟', definition: '端到端耗时（检索 + 重排 + 生成）', target: '按场景定义', failure: '重排或上下文过长' },
];

const notes = [
    '分块必须保留标题路径与原文位置，否则无法把回答回链到原文。',
    '索引与查询必须使用同一个 embedding 模型；更换模型要重建全部索引。',
    'topK 不是越大越好：上下文越长，成本越高，也越容易被无关片段干扰。',
    '引用编号必须回查真实片段，不能只信模型自己写的编号。',
    '评估集要包含「资料不足」的问题，否则无法衡量拒答与幻觉。',
];
</script>

<template>
    <DocPage
        title="RAG 检索评估"
        description="RAG 的质量由召回决定：检索不到正确片段，生成再流畅也是幻觉。本页覆盖分块、向量化、重排、引用溯源与 Recall@K 评估。"
        :tags="['分块', 'embedding', '重排', '引用溯源', 'Recall@K']"
    >
        <DocSection id="chunk" title="分块：决定召回的基本单位" kicker="01 · CHUNK">
            <p class="body-text">
                分块不是「把文档切短」，而是<strong>定义检索的最小语义单元</strong>。
                切得太碎，块里没有完整结论；切得太大，向量被多主题稀释，召回精度下降。
                每块都要保留标题路径、原文位置与更新时间，它们是引用溯源的基础。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>方法</th><th>优点</th><th>缺点</th><th>适用</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in chunkRows" :key="row.method">
                            <td>{{ row.method }}</td>
                            <td>{{ row.pros }}</td>
                            <td>{{ row.cons }}</td>
                            <td>{{ row.fit }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="CHUNK_CODE" lang="ts" title="块结构与元数据" />
        </DocSection>

        <DocSection id="retrieve" title="向量化、召回与重排" kicker="02 · RETRIEVE">
            <p class="body-text">
                向量检索负责「广度」：先取回较多候选；重排负责「精度」：
                用更强的模型给候选打分，再截取少量片段进入上下文。
                只做向量检索不做重排，通常会看到「相关但不精确」的结果。
            </p>
            <CodeBlock :code="RETRIEVE_CODE" lang="ts" title="查询、召回与重排" />
            <Callout type="info" title="索引与查询模型必须一致">
                换 embedding 模型后，旧索引与新查询向量不在同一空间，
                相似度计算会完全失效。必须整库重建，而不是只改查询侧。
            </Callout>
        </DocSection>

        <DocSection id="cite" title="引用溯源：让结论可核对" kicker="03 · CITATION">
            <p class="body-text">
                可核对的引用是 RAG 与「直接让模型回答」的核心区别。
                做法是在提示词里给每个片段编号，要求模型标注引用；
                返回后再用正则抽取编号，回查片段是否真实存在。
                模型写的编号不可信，必须由服务端验证。
            </p>
            <CodeBlock :code="CITE_CODE" lang="ts" title="引用约束与回查" />
        </DocSection>

        <DocSection id="eval" title="用指标而不是感觉评估" kicker="04 · EVAL">
            <p class="body-text">
                「回答看起来不错」不能作为验收标准。至少要维护一组带标准片段 id 的离线问题集，
                分别衡量检索（Recall@K）与生成（引用准确率、幻觉率、拒答率）。
                指标下降时，才能判断是分块、索引、重排还是提示词的问题。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>指标</th><th>定义</th><th>目标</th><th>不达标意味着</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in evalRows" :key="row.metric">
                            <td class="mono">{{ row.metric }}</td>
                            <td>{{ row.definition }}</td>
                            <td>{{ row.target }}</td>
                            <td>{{ row.failure }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <CodeBlock :code="EVAL_CODE" lang="ts" title="Recall@K 的最小实现" />
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
