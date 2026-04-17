# LLM 配置说明

## 支持的模型提供商

本项目支持两种大模型 API：

1. **OpenAI 兼容 API**（阿里云 DashScope、其他兼容 OpenAI 接口的服务）
2. **智谱 AI**（GLM 系列模型）

## 配置方式

在 `.env` 文件中配置：

### 1. 使用智谱 API（推荐，速度更快）

```bash
# 智谱 API 配置
zhipu.key=你的智谱API Key
zhipu.llm=glm-4.7-flash

# 选择智谱作为 LLM 提供商
llm.provider=zhipuai
```

### 2. 使用 OpenAI 兼容 API

```bash
# OpenAI 兼容 API 配置
api.key=你的API Key
api.url=https://api-endpoint.com/v1
api.llm=模型名称

# 选择 OpenAI 兼容 API 作为 LLM 提供商
llm.provider=openai
```

## 切换模型

只需修改 `.env` 文件中的 `llm.provider` 配置：

- `llm.provider=zhipuai` → 使用智谱 API
- `llm.provider=openai` → 使用 OpenAI 兼容 API

修改后**无需重启后端**（如果开启了自动重载），或重启后端服务即可。

## 推荐模型

### 智谱 API

| 模型 | 速度 | 质量 | 说明 |
|------|------|------|------|
| `glm-4.7-flash` | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | 最快，推荐用于心情分析 |
| `glm-4.7` | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | 质量更好，稍慢 |
| `glm-4-flash` | ⚡⚡⚡⚡⚡ | ⭐⭐⭐ | 轻量级，最快 |

### OpenAI 兼容 API（阿里云 DashScope）

| 模型 | 速度 | 质量 | 说明 |
|------|------|------|------|
| `qwen-turbo` | ⚡⚡⚡⚡⚡ | ⭐⭐⭐ | 最快 |
| `qwen-plus` | ⚡⚡⚡⚣ | ⭐⭐⭐⭐ | 平衡选择 |
| `qwen-max` | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | 质量最好 |

## 性能优化

当前配置已优化：
- ✅ `temperature=0.7` - 稳定输出
- ✅ `max_tokens=150` - 限制输出长度
- ✅ `top_p=0.9` - 限制候选词范围
- ✅ 文本截取 1500 字符 - 减少输入 token

预计响应时间：
- 智谱 glm-4.7-flash：**2-5 秒**
- 阿里云 qwen-turbo：**3-8 秒**

## 故障排查

### 日志查看

启动后端后，查看初始化日志确认使用的模型：

```
MoodAnalyzer 初始化完成，使用智谱 API, 模型: glm-4.7-flash
```

或

```
MoodAnalyzer 初始化完成，使用 OpenAI 兼容 API, 模型: qwen-turbo
```

### 常见问题

**Q: 切换模型后没有生效？**
A: 重启后端服务：`./start.sh restart`

**Q: 提示 API Key 未配置？**
A: 检查 `.env` 文件中对应的配置是否正确

**Q: 响应仍然很慢？**
A: 尝试使用 `glm-4.7-flash` 或 `qwen-turbo` 模型
