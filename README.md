# New API 个人插件库

收录可按需上传到 New API 的自定义插件。

## 插件列表

| 插件 | 功能 | 文件 |
| --- | --- | --- |
| Gemini 录音复刻 | 创建和查询复刻音色，用 `voice_id` 合成旁白 | [插件文件](plugins/gemini-voice/plugin.js) · [运维配置](plugins/gemini-voice/README.md) |

## 安装

运维使用 Root 账号进入 New API 的「任务插件」页面（`/task-plugins`），选择要安装的插件，上传并启用对应的 `plugin.js`。渠道、权限和验收步骤见各插件的说明。

## 目录与版本

每个插件放在独立的 `plugins/<插件标识>/` 目录，包含 `plugin.js` 和中文 `README.md`。新插件使用唯一的 `meta.key`。升级已有插件时保留 `meta.key`，提高 `meta.version`，再由运维上传新版。
