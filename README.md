# UniKit Edinburgh 网页端 MVP

[![CI](https://github.com/Janice36fang/UniKit-Edinburgh-/actions/workflows/ci.yml/badge.svg)](https://github.com/Janice36fang/UniKit-Edinburgh-/actions/workflows/ci.yml)

这是一个可直接运行的三页 Web MVP：页面1支持上传住宿合同让AI预填，也支持完全手动填写；页面2进行“AI预填＋人工确认”；页面3由确定性规则生成第一周采购方案。浏览器和后端复用同一套规则；没有任何 API Key 时，也可以完整走通三页、排重、规格检查和预算调整。项目同时生成 `UniKit_Edinburgh.html` 单文件版，可直接发给别人并双击使用。

**在线演示：** [UniKit Edinburgh｜第一周采购助手](https://unikit-edinburgh-production.up.railway.app/?v=1.7.0&provider=gemini#profile)

在线演示已部署到 Railway，并在服务器端配置 Gemini；仓库不包含任何真实 API Key。商品价格目前仍为明确标注的规则参考价或演示快照，尚未配置实时商品搜索密钥。

## 已实现

- 第 1 页：可上传PDF、图片或文本合同，AI只提取材料明确出现的房型、床型和宿舍设施；同时完整保留手动填写。还包括床品准备、预算、做饭频率、位置、行李空间、招待人数和已携带物品。
- 第 2 页：展示AI识别值、原文依据和置信度；材料未提及的字段固定为“不确定”。用户可逐项修改，并必须人工确认后才能生成方案。未使用AI时则作为普通设施确认表使用。
- 第 3 页：15—20 个品类级结果、P0/P1/P2、规格提醒、预算不足状态、商品事实来源和预算重算差异。
- 购买阶段：明确区分 `国内带`、`英国买`、`出发前核实`、`入住后核实`、`以后再买`。
- 行李与购买地：默认支持 `2×23kg + 1 件随身行李`，也可选择其他额度或自定义。剩余空间的公斤区间与“约占一个箱子的几分之几”会随额度动态变化；床品、锅具和英国电器仍优先在英国确认规格后买。
- 国内准备清单：已录入用户图片中的 33 项厨具及生活用品，可勾选“已准备”；明确对应的餐具套装、衣架、垃圾袋会自动排重，锅具保留炉灶兼容校验，刀具与五金工具标注仅托运。
- 购买参考：没有商品 API 时显示英文购买名、英国规则参考价，以及 Google Shopping、Argos、Dunelm、IKEA UK 或 Amazon UK 的可点击搜索入口；配置商品 API 后优先显示通过规格检查的具体商品直链和实时价格。
- 预算口径：页面 1 的预算明确为“英国落地采购预算”；国内携带项不计入英镑支出，同时显示英国补购参考价，避免用虚构人民币价格混算。
- 餐具数量：做饭频率与招待人数分开计算，解决“低频做饭但社交餐具需求高”的问题。
- 空间与设备：厨房储物有限时减少大套装倾向；有洗碗机时提示可机洗规格；电磁炉只搜索明确兼容的锅具。
- 会话状态：资料保存在当前浏览器标签页的 `sessionStorage`，刷新不丢失；不创建账号。
- 可访问性与响应式：键盘焦点、错误摘要、非颜色状态标签，并适配 360px 宽度。
- AI边界：AI负责把非结构化合同转换成结构化字段；用户负责确认；排重、规格、安全、购买地和预算仍由确定性规则完成。
- AI来源设置：页头可在 Gemini 免费层、OpenAI API 与本地演示模式之间切换、选择允许的模型并测试连接。默认优先 Gemini；Codex桌面Agent明确标为开发辅助，不伪装成公开网页可调用的生产接口。
- 公共演示保护：Gemini密钥只保存在服务器环境变量中；默认每个访客每天最多调用 8 次，额度用尽后表单、规则清单和手动填写仍可使用。

## 演示数据与真正功能

| 模块 | 当前默认状态 | 配置密钥后 |
| --- | --- | --- |
| 表单状态、校验、页面联动 | 真正功能 | 不变 |
| 宿舍合同识别 | 粘贴文字可使用本地演示规则；PDF/图片提示需要服务器 | Gemini 免费层或 OpenAI 文件/视觉输入＋严格 JSON Schema，返回证据和置信度 |
| 已带物品排重 | 本地中英词典，真正参与排重 | Gemini/OpenAI 结构化解析；失败时仍可继续使用本地词典 |
| 规则、优先级、购买地、预算 | 真正功能，完全由代码计算 | 不变，AI 不参与金额与硬规则 |
| 品类参考价 | 规则参考区间中的单点 MVP 估值，明确标注 | 不变；仍与实时商品价分开 |
| 商品候选 | 带日期的演示快照，链接/配送/评分为空 | SerpAPI Google Shopping 英国结果，经过商家白名单、去重和规格过滤 |
| 预算价格 | 规则参考价；演示快照不覆盖预算 | 通过检查的默认 API 候选实价进入预算，其余品类保留规则参考价 |
| 缺失商品字段 | 显示“信息不足” | 同样显示“信息不足”，不让 AI 补写 |

演示快照只用于展示接口失败时的 UI，不代表实时价格，也不参与“商品实时价”的宣传。代码中的规则参考价需要在真实用户研究和渠道核对后再校准。

## 项目目录

```text
unikit-mvp/
├── public/
│   ├── index.html              # 三页页面结构
│   ├── styles.css              # 设计系统与响应式样式
│   └── js/
│       ├── app.js              # 前端状态、表单与页面联动
│       ├── catalog.js          # 25 个稳定品类与设施字段
│       ├── contract.js         # 合同字段、本地演示识别与未知值兜底
│       └── engine.js           # 排重、规格、购买地与预算引擎
├── adapters/
│   ├── openai.mjs              # AI 自由文本结构化，失败重试一次
│   ├── contract.mjs            # PDF/图片合同理解与严格结构化输出
│   ├── gemini.mjs              # Gemini免费层的PDF/图片与自由文本适配
│   └── serpapi.mjs             # 英国商品搜索、白名单、去重与规格过滤
├── data/product-snapshot.mjs   # 明确标注日期的演示兜底
├── test/                       # 自动化规则、合同与服务测试
├── build-standalone.mjs       # 生成可直接转发的单文件网页版
├── Start UniKit.command        # macOS 双击启动入口
├── server.mjs                  # 零依赖静态服务与后端 API
├── .env.example                # 可选密钥配置
├── Dockerfile                  # 容器部署
└── package.json
```

## 本地运行

需要 Node.js 20 或更高版本，不需要安装第三方依赖。

macOS 用户可以直接双击 `Start UniKit.command`。首次运行如果系统阻止，可在访达中右键该文件并选择“打开”。启动后请保持终端窗口开启，不要直接双击 `public/index.html`。

```bash
cd outputs/unikit-mvp
npm start
```

打开 `http://127.0.0.1:4173`。运行测试：

```bash
npm test
```

### 转发给别人

运行 `npm run build:share` 会在项目上一级生成 `UniKit_Edinburgh.html`。收件人不需要安装 Node.js，下载后用 Chrome、Edge 或 Safari 双击打开即可完成三页流程。单文件版可粘贴合同文字体验本地演示预填，并包含规则、预算计算和零售商搜索链接；PDF/图片的真实AI识别和商品实时API只在服务器版中启用。

## 接入真实 AI 与商品搜索

复制 `.env.example` 为 `.env`，只在服务端填写密钥：

```dotenv
GEMINI_API_KEY=你的Google AI Studio密钥
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_MODEL_ALLOWLIST=gemini-3.1-flash-lite,gemini-3-flash-preview
GEMINI_DAILY_LIMIT=8
AI_DEFAULT_SOURCE=gemini

# 可选的付费备用来源
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-5-mini
OPENAI_MODEL_ALLOWLIST=gpt-5-mini,gpt-5.4-mini
SERPAPI_API_KEY=你的密钥
PRODUCT_MERCHANT_ALLOWLIST=Argos,IKEA,Dunelm,John Lewis,Tesco,ASDA
```

密钥不会发送到浏览器。默认使用 Gemini `generateContent` 的内联PDF/图片输入与 JSON Schema 结构化输出；合同没有明确依据的字段会在服务端再次降级为“不确定”。免费层的数据政策与付费层不同，因此公共演示只允许使用脱敏或示例合同。实现依据为 [Gemini PDF理解文档](https://ai.google.dev/gemini-api/docs/document-processing)、[结构化输出文档](https://ai.google.dev/gemini-api/docs/structured-output) 与 [免费层价格说明](https://ai.google.dev/gemini-api/docs/pricing)。OpenAI仍作为可选备用来源，并继续设置 `store: false`。

商品搜索使用 SerpAPI Google Shopping，参数为 `location=Edinburgh, Scotland, United Kingdom`、`gl=uk`、`hl=en`、`google_domain=google.co.uk`。返回值会经过商家白名单、SKU 去重、价格缺失标记、电磁炉关键词和床型冲突过滤。通过检查的第一个有效候选会成为预算价格并保留抓取时间；API 失败、价格缺失或只有演示快照时继续使用规则参考价。参数与字段依据为 [SerpAPI Google Shopping 官方文档](https://serpapi.com/google-shopping-api) 和 [Shopping results 字段文档](https://serpapi.com/shopping-results)。

### API

- `GET /api/health`：显示规则、AI 解析与商品搜索当前模式。
- `GET /api/ai-settings`：返回可用AI来源、服务器默认模型和允许选择的模型，不返回密钥。
- `POST /api/ai-test`：按用户点击触发最小连接测试，检查Gemini/OpenAI密钥、模型权限和可用额度。
- `POST /api/parse-contract`：输入 `aiSource`、`aiModel` 与粘贴文字或4MB以内的PDF/图片数据，返回房型、床型、设施、证据和置信度。
- `POST /api/parse-items`：输入 `aiSource`、`aiModel` 和 `{ "text": "转换插头、一条薄毯子" }`，返回确认项、不确定项和未匹配项。
- `POST /api/recommendations`：输入 `profile + facilities + parsedCarried`，返回规则清单、预算结果与最多 5 组商品候选。
- `POST /api/rebudget`：只重新运行预算组合器，不重新调用 AI 或商品搜索。

## 购买地规则

购买地是可复现的规则，不由模型猜测：

1. 用户已经到英国：不再输出“国内带”作为可执行动作。
2. 床品尺寸、炉具兼容或住宿设施未确认：进入“入住后核实”。
3. 床品、锅具、大件、液体与英国用电设备：默认英国确认后购买。
4. 英标转换插头、常用洗漱、浴巾、拖鞋等小件：用户仍在国内且行李允许时建议国内带。
5. 餐具、枕套、清洁海绵等可选小件：只有行李空间充足时建议国内带。
6. 国内携带的电器相关物品仍显示 Type G、电压和住宿限制提醒；“国内买”不等于“规格自动合格”。
7. 国内携带项不计入英国落地预算；若需在英国补购，则显示英国规则参考价。

### 行李额度换算

生活用品空间首先用“占全部托运行李的比例”和“相当于几个箱子”表达，公斤数只作辅助换算。默认 `2×23kg` 时，三档分别是：半个箱子—1 个箱子（约 11.5—23kg）、1—1.5 个箱子（约 23—34.5kg）、1.5—2 个箱子（约 34.5—46kg）。更改箱子件数或单件额度后，箱子范围和公斤数会一起重算；随身行李只作为额度背景，不默认分配给生活用品。

## 部署

### Node Web 服务

把整个目录部署到任意支持 Node.js 20+ 的 Web 服务：

- 启动命令：`npm start`
- 健康检查：`/api/health`
- 环境变量：在部署平台的 Secret 设置中填写，不要提交 `.env`
- 对外监听：设置 `HOST=0.0.0.0`，`PORT` 使用平台提供的值

当前公开演示使用 Railway。通过 Railway CLI 部署本目录时，`.railwayignore`、`.dockerignore` 和 `.gitignore` 会共同排除本地密钥文件；`GEMINI_API_KEY` 必须在 Railway Variables 中单独设置。

仓库中的 `railway.toml` 已配置 `/api/health` 健康检查和失败自动重启。`.github/workflows/ci.yml` 会在每次推送或 Pull Request 时运行完整自动测试。

### Docker

```bash
docker build -t unikit-mvp .
docker run --rm -p 4173:4173 --env-file .env unikit-mvp
```

静态托管只能运行浏览器内的规则降级，不应暴露 Gemini、OpenAI 或 SerpAPI 密钥。要让其他人通过公开链接使用真实AI合同识别，必须同时部署 `server.mjs`（或等价的 Serverless Functions），把密钥放在托管平台的 Secret 中，并保留调用限流。

## 暂不伪装为已完成的能力

- 尚未接入宿舍官网/合同的权威设施与精确床铺尺寸数据。
- 尚未实现室友认领、费用分摊、物品归属和搬家盘点；这些适合下一阶段，不应挤占首次入住 MVP。
- 尚未为商品补齐展开尺寸、退换政策和配送承诺；API 没返回时页面保持“信息不足”。
- 未运行真实 API 的人工核对前，不声称实时覆盖某个零售商、最低价或推荐准确率。
- 自动化测试验证代码规则，不替代 5—6 名目标用户的可用性测试。
