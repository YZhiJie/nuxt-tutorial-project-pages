# Nuxt 4 实战漫画剧场 · 霓虹墨 Neon Ink

用四格漫画讲透 Nuxt 4 实战知识：每话一个真实开发困境，从踩坑到揭秘再到实证结案。漫画与《Nuxt 4 实战教程》八个部分一一对应，是教程正文的「剧情版入口」。

三位常驻角色：橙发行动派**标签君**负责踩坑动手，青发提问担当**像素酱**负责一针见血，白发教授**码叔**负责揭秘原理与结案总结。

## 各话导航

| 话 | 标题 | 对应教程部分 | 链接 |
| --- | --- | --- | --- |
| EP.01 | 初识 Nuxt 4 | 01-what-is-nuxt | [EP.01-nuxt-intro.md](EP.01-nuxt-intro.md) |
| EP.02 | 路由的约定之力 | 03-file-based-routing | [EP.02-routing.md](EP.02-routing.md) |
| EP.03 | 组件与布局 | 05-components | [EP.03-views-layouts.md](EP.03-views-layouts.md) |
| EP.04 | 数据获取之道 | 07-usefetch | [EP.04-data-fetching.md](EP.04-data-fetching.md) |
| EP.05 | 状态不串号 | 09-usestate | [EP.05-state-management.md](EP.05-state-management.md) |
| EP.06 | 服务端全栈 | 11-server-api | [EP.06-server-fullstack.md](EP.06-server-fullstack.md) |
| EP.07 | 工程化体检 | 13-plugins-modules-seo | [EP.07-engineering.md](EP.07-engineering.md) |
| EP.08 | 构建与部署 | 15-build-prerender | [EP.08-deployment.md](EP.08-deployment.md) |

## 观看方式

在项目根目录启动静态服务器后，用浏览器打开阅读器：

```bash
python3 -m http.server 8000
# 访问 http://localhost:8000/comics/
```

阅读器支持翻页 / 长卷两种模式，点击「讲解」可打开本话对应的讲解稿抽屉。

## 创作与门禁

漫画不手写 SVG：在 `scripts/EP.NN.json` 里写分镜数据，用生成器产出 SVG 与 manifest：

```bash
node comics/generate-comics.mjs   # 分镜 JSON → SVG + manifest.json
node comics/check-comics.mjs      # 门禁：良构性 + 溢出 + MD 完整性
```

视觉与叙事规范见 [style-guide.md](style-guide.md)；新增或修改任何一话后，必须通过门禁（0 错误 0 警告）才算完成。
