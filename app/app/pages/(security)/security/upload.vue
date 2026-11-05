<script setup lang="ts">
definePageMeta({ layout: 'docs' });

const UPLOAD_CODE = `// server/api/upload.post.ts（示例，不在本项目中实现）
import { basename } from 'node:path';

const MAX_SIZE = 2 * 1024 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function matches(data: Buffer, signature: number[]): boolean {
    if (data.length < signature.length) return false;
    return signature.every((byte, index) => data[index] === byte);
}

// 文件名净化：去掉路径、控制字符与危险字符
function sanitizeFilename(raw: string): string {
    const base = basename(raw).replace(/[^a-zA-Z0-9._-]/g, '_');
    return base.slice(0, 80) || 'upload';
}

export default defineEventHandler(async (event) => {
    const parts = await readMultipartFormData(event);
    const file = parts?.find((part) => part.name === 'file');

    if (!file?.data || !file.filename) {
        throw createError({ statusCode: 400, message: '缺少文件' });
    }

    // 1) 大小：以实际字节数为准，不信任 Content-Length
    if (file.data.length > MAX_SIZE) {
        throw createError({ statusCode: 413, message: '文件不得超过 2MB' });
    }

    // 2) 类型：读 magic bytes，而不是看扩展名或 MIME
    const isPng = matches(file.data, PNG_SIGNATURE);
    const isJpeg = matches(file.data, JPEG_SIGNATURE);
    if (!isPng && !isJpeg) {
        throw createError({ statusCode: 415, message: '仅支持 PNG / JPEG' });
    }

    // 3) 扩展名由检测结果决定，不采用用户文件名
    const ext = isPng ? 'png' : 'jpg';
    const safeName = sanitizeFilename(file.filename);
    const key = 'uploads/' + Date.now() + '-' + safeName + '.' + ext;

    // 4) 存储层：对象存储私有桶，随机 key，禁止执行
    await saveObject(key, file.data, {
        contentType: isPng ? 'image/png' : 'image/jpeg',
        acl: 'private',
    });

    return { key };
});`;

const SNIFF_CODE = `// 只读文件头，成本极低
function detectType(data: Buffer): 'png' | 'jpeg' | 'gif' | 'pdf' | 'zip' | null {
    const hex = data.subarray(0, 12).toString('hex');

    if (hex.startsWith('89504e470d0a1a0a')) return 'png';
    if (hex.startsWith('ffd8ff')) return 'jpeg';
    if (hex.startsWith('47494638')) return 'gif';
    if (hex.startsWith('25504446')) return 'pdf';
    if (hex.startsWith('504b0304')) return 'zip'; // docx / xlsx 也基于 zip
    return null;
}

// 注意：magic bytes 只能证明“文件头像”，
// 不能证明内容安全。图片应重新编码，文档应在沙箱中处理。`;

const STORAGE_CODE = `// 存储与回显的四条硬规则
// 1) 私有桶 + 随机 key，不把原始文件名拼进 URL
// 2) 文件名只用于展示，下载时加 Content-Disposition: attachment
// 3) 上传目录不执行脚本，最好放在独立域名 / CDN
// 4) 图片走服务端转码，剥离 EXIF 与隐藏 payload

setResponseHeader(event, 'Content-Disposition', 'attachment; filename="download.png"');
setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
setResponseHeader(event, 'Content-Type', 'application/octet-stream');`;

const SSRF_CODE = `// 出站请求：白名单 + 私网段拦截 + 逐跳校验
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const ALLOWED_HOSTS = new Set(['api.example.com', 'images.example.com']);

function isPrivateIp(ip: string): boolean {
    if (ip === '::' || ip === '::1' || ip === '0.0.0.0') return true;
    if (ip.startsWith('::ffff:')) return isPrivateIp(ip.slice(7));
    if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
        return true; // link-local / fc00::/7
    }

    if (ip.startsWith('127.') || ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;

    const [a, b] = ip.split('.').map(Number);
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
}

export async function assertSafeOutboundUrl(raw: string): Promise<URL> {
    const url = new URL(raw);

    if (url.protocol !== 'https:') {
        throw createError({ statusCode: 400, message: '仅允许 HTTPS' });
    }
    if (url.username || url.password) {
        throw createError({ statusCode: 400, message: '禁止 URL 携带用户信息' });
    }
    if (url.port && url.port !== '443') {
        throw createError({ statusCode: 400, message: '仅允许 443 端口' });
    }
    if (!ALLOWED_HOSTS.has(url.hostname)) {
        throw createError({ statusCode: 403, message: '域名不在白名单' });
    }

    const resolved = await lookup(url.hostname);
    if (isIP(resolved.address) && isPrivateIp(resolved.address)) {
        throw createError({ statusCode: 403, message: '禁止访问内网地址' });
    }

    return url;
}

// 关键：redirect 设为 manual，每一跳都重新校验
const response = await $fetch(target, { redirect: 'manual' });`;

const ATTACKS = [
    { attack: '伪装扩展名', how: 'shell.php.jpg / 双扩展名', defense: 'magic bytes + 服务端决定扩展名' },
    { attack: 'Content-Type 伪造', how: '请求头声明 image/png', defense: '不信任客户端 MIME' },
    { attack: '多语言文件', how: 'GIF89a 开头 + PHP 代码', defense: '图片转码 / 禁止上传目录执行' },
    { attack: '路径穿越', how: '../../../etc/passwd', defense: 'basename + 随机 key' },
    { attack: '存储型 XSS', how: '上传 SVG / HTML', defense: '独立域名 + attachment + CSP' },
    { attack: '拒绝服务', how: '超大文件 / 解压炸弹', defense: '字节上限 + 解压后上限 + 超时' },
];

const SSRF_ATTACKS = [
    'http://127.0.0.1:6379 —— 访问本机 Redis',
    'http://169.254.169.254/latest/meta-data —— 云厂商元数据',
    'http://10.0.0.5/admin —— 内网管理后台',
    'http://[::1]:8080 —— IPv6 回环',
    'https://allowed.com@evil.com —— userinfo 伪装',
    '302 跳转到内网 —— 只校验首跳会失效',
];
</script>

<template>
    <DocPage
        title="上传防护与 SSRF"
        description="上传接口同时面对文件内容、存储路径与回显三条攻击面；任何“由服务端主动请求用户提供的 URL”的能力，都可能被用来打内网。"
        :tags="['上传', 'magic bytes', '文件名净化', 'SSRF', '白名单']"
    >
        <DocSection id="attack" title="上传的攻击面" kicker="01 · ATTACK">
            <p class="body-text">
                上传不是一个“存文件”的动作，而是把不可信字节放进系统。
                扩展名、Content-Type、原始文件名都可以伪造；真正的防线在服务端：
                看实际字节、限制大小、重命名、隔离存储、安全回显。
            </p>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>攻击</th><th>手法</th><th>防御</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in ATTACKS" :key="row.attack">
                            <td>{{ row.attack }}</td>
                            <td>{{ row.how }}</td>
                            <td>{{ row.defense }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

<DocSection id="server" title="服务端二次校验" kicker="02 · SERVER">
            <p class="body-text">
                前端 <code>accept="image/*"</code> 只是选择器提示，不能作为校验依据。
                服务端要按顺序检查：文件存在 → 实际字节大小 → magic bytes →
                净化文件名 → 由检测结果决定扩展名 → 隔离存储。
            </p>
            <CodeBlock :code="UPLOAD_CODE" lang="ts" title="上传接口的四道校验" />
            <CodeBlock :code="SNIFF_CODE" lang="ts" title="magic bytes 检测" />
            <Callout type="warn" title="magic bytes 不是内容安全">
                文件头只能证明“它看起来像 PNG”，不能证明像素与元数据安全。
                图片应在服务端重新编码，文档应在沙箱或隔离进程中处理，
                上传目录永远不要开启脚本执行。
            </Callout>
        </DocSection>

        <DocSection id="storage" title="存储、命名与回显" kicker="03 · STORAGE">
            <p class="body-text">
                原始文件名可能包含路径、控制字符、超长 Unicode 或伪装的扩展名。
                服务端应只取 basename、白名单字符、截断长度，并用随机 key 存储。
                回显时明确 <code>Content-Disposition</code> 与
                <code>nosniff</code>，避免浏览器把内容当页面执行。
            </p>
            <CodeBlock :code="STORAGE_CODE" lang="ts" title="安全存储与回显" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>检查项</th><th>要求</th><th>原因</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>大小</td><td>按实际字节数限制</td><td>Content-Length 可伪造或缺失</td></tr>
                        <tr><td>类型</td><td>magic bytes 白名单</td><td>扩展名与 MIME 均可伪造</td></tr>
                        <tr><td>文件名</td><td>basename + 字符白名单 + 截断</td><td>防路径穿越与超长名</td></tr>
                        <tr><td>存储</td><td>私有桶、随机 key、不可执行</td><td>防遍历与 webshell</td></tr>
                        <tr><td>回显</td><td>独立域名 + attachment + nosniff</td><td>防存储型 XSS</td></tr>
                    </tbody>
                </table>
            </div>
        </DocSection>

        <DocSection id="ssrf" title="SSRF：出站请求白名单" kicker="04 · SSRF">
            <p class="body-text">
                只要服务端接受用户提供的 URL 并去请求（图片抓取、Webhook 测试、URL 预览），
                就可能被用来访问内网、云元数据或本机服务。防御顺序是：
                协议白名单 → 域名白名单 → DNS 解析后私网段拦截 → 重定向逐跳校验。
            </p>
            <CodeBlock :code="SSRF_CODE" lang="ts" title="白名单 + 私网段拦截" />
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>危险目标</th><th>说明</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in SSRF_ATTACKS" :key="item">
                            <td class="mono">{{ item }}</td>
                            <td>需要在解析、连接与重定向三层拦截</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <Callout type="danger" title="DNS 重绑定">
                只校验一次 DNS 结果不够：攻击者可以让域名先解析到公网 IP，
                请求时再解析到内网。应固定解析结果、在连接层校验 IP，
                并禁用或重校验每一次重定向。
            </Callout>
        </DocSection>

        <DocSection id="checklist" title="上线检查单" kicker="05 · CHECKLIST">
            <ul class="checklist">
                <li>上传大小、类型、数量都有服务端上限，且超限返回 413 / 415。</li>
                <li>文件存储在私有桶或不可执行目录，使用随机 key，不拼接原始文件名。</li>
                <li>图片重新编码；文档解析放在隔离进程；下载响应带 attachment 与 nosniff。</li>
                <li>所有出站请求走统一的安全请求函数，默认拒绝、显式白名单。</li>
                <li>禁止 http、file、gopher、dict 等协议；禁止 userinfo 伪装与非常规端口。</li>
                <li>记录出站目标与失败原因，便于发现扫描与内网探测。</li>
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
    padding-left: 26px;
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
}

.checklist li::before {
    content: '✓';
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
}
</style>
