# Gemini 录音复刻

计费用量上报以 New API `v1.0.0-rc.51` 为目标。在测试环境用 Root 账号进入任务插件管理，上传并启用 [plugin.js](plugin.js)。

新建专用的 Task Plugin 渠道，绑定 `gemini-voice`，上游地址填 `https://generativelanguage.googleapis.com`。使用同一 Google 项目的 API Key，并为渠道和服务端 Token 开通需要的模型。创建复刻音色时由调用方传入 `voice.model`，Admin 默认传入 `gemini-3.8-flash-tts`。试听和合成使用 `gemini-3.8-flash-lite-tts`，逐词转录使用 `gemini-3.5-transcribe`。

接入的服务端用 New API Bearer Token 调用以下路径。如果顶层路径被现有路由占用，使用 `/gemini-voice` 前缀并检查插件详情中的 `skipped_routes`。

| 方法和路径 | 验收 |
| --- | --- |
| `POST /v1beta/voices` | 在 JSON 中提交同一位说话人的参考录音和授权录音，取得 `voice_id` |
| `POST /v1beta/interactions` | 使用该 `voice_id` 合成，可解码并播放音频 |
| `POST /v1beta/transcriptions` | 以 `multipart/form-data` 提交 `audio` 字段中的 WAV，返回带逐词时间戳的转录 JSON。文件上限为 28,800,044 字节 |

New API `v1.0.0-rc.49` 实测不接受无请求体的 `GET /v1beta/voices`，业务侧可从自己的数据库读取音色列表。

创建、合成和转录均同步返回，插件关闭任务结果留存。联调时确认网关日志不输出录音请求体或音频响应体。创建音色属于写操作，避免在调用超时或上游状态不明时自动重试。

## 模型定价

在 New API「模型定价」为以下模型配置任务用量表达式。示例按 Google 标准付费单价计算，表达式结果为美元。合成示例适用至 2026 年 12 月 31 日。2027 年 1 月 1 日起，Google 公布的合成单价分别为每百万输入 Token 1 美元、每百万输出 Token 12 美元。[Google Gemini API 定价](https://aistudio.google.com/docs/pricing)

| 模型 | 任务用量表达式 |
| --- | --- |
| `gemini-3.8-flash-lite-tts` | `tier("base", u("input_tokens") * 0.5 / 1000000 + u("output_tokens") * 6 / 1000000)` |
| `gemini-3.5-transcribe` | `tier("base", u("input_tokens") * 2 / 1000000 + u("output_tokens") * 12 / 1000000)` |

合成按 8,192 个输入 Token 和 16,384 个输出 Token 预扣。转录按 24 kHz 单声道 16 位 PCM 的文件大小估算时长，再按每秒 25 个音频输入 Token 和每分钟 175 个文本输出 Token 预扣。成功后按 Google 返回的实际用量多退少补，响应缺少有效用量时保留预扣额。

插件原样转发创建请求的 `voice.model`。请为 Admin 使用的复刻模型配置按次定价。使用 Flash-Lite 查询音色列表时，插件上报零 Token 用量。
