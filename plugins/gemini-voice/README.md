# Gemini 录音复刻

适用版本为 New API `v1.0.0-rc.49`。在测试环境用 Root 账号进入任务插件管理，上传并启用 [plugin.js](plugin.js)。

新建专用的 Task Plugin 渠道，绑定 `gemini-voice`，上游地址填 `https://generativelanguage.googleapis.com`。在同一渠道配置同一个 Google 项目的 Gemini API Key，并为 `gemini-3.8-flash-tts` 和 `gemini-3.8-flash-lite-tts` 配置计费及服务端 Token 权限。创建复刻音色使用 Flash TTS，试听和合成使用 Lite TTS。

接入的服务端用 New API Bearer Token 调用以下路径。如果顶层路径被现有路由占用，使用 `/gemini-voice` 前缀并检查插件详情中的 `skipped_routes`。

| 方法和路径 | 验收 |
| --- | --- |
| `POST /v1beta/voices` | 在 JSON 中提交同一位说话人的参考录音和授权录音，取得 `voice_id` |
| `POST /v1beta/interactions` | 使用该 `voice_id` 合成，可解码并播放音频 |

New API `v1.0.0-rc.49` 实测不接受无请求体的 `GET /v1beta/voices`，业务侧可从自己的数据库读取音色列表。

创建和合成均即时返回，插件关闭任务结果留存。联调时确认网关日志不输出录音请求体或音频响应体。创建音色属于写操作，避免在调用超时或上游状态不明时自动重试。
