# 墨问心情 - Chrome 浏览器插件

一款基于 AI 分析的墨问笔记心情追踪插件，通过阿里云百炼 API 分析笔记情感，生成 -10° 到 40° 的心情温度值。

## 功能特性

- **心情趋势图**：展示笔记的心情温度变化趋势
- **动态天气背景**：根据心情值生成对应的天气动画效果
  - 低温 (< 10°)：雨/雪效果
  - 中温 (10-25°)：多云/晴朗
  - 高温 (> 25°)：晴天/阳光
- **笔记列表**：展示 20 条带温度标识的笔记
- **分享心情**：点击插件图标可分析当前笔记心情

## 项目结构

```
mowen-mood/
├── backend/                 # Flask 后端服务
│   ├── app.py              # 应用入口
│   ├── config.py           # 配置加载
│   ├── database.py         # SQLite 数据库
│   ├── routes.py           # API 路由
│   ├── mood_analyzer.py    # 心情分析模块
│   ├── mowen_client.py     # 墨问 API 客户端
│   └── requirements.txt     # Python 依赖
├── extension/               # Chrome 扩展前端
│   ├── src/
│   │   ├── popup/          # 弹窗 UI
│   │   ├── components/     # React 组件
│   │   ├── services/       # API 服务
│   │   └── types/          # TypeScript 类型
│   ├── public/             # 静态资源
│   └── package.json         # Node 依赖
├── .env                     # 环境配置
└── extension/dist/          # 编译输出目录
```

## 环境配置

在项目根目录创建 `.env` 文件：

```env
api.key=your_api_key_here
api.url=https://coding.dashscope.aliyuncs.com/v1
api.llm=qwen3.5-plus
```

## 启动后端服务

### 1. 安装 Python 依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 验证服务

```bash
curl http://localhost:5000/api/health
```

返回以下内容表示服务正常运行：
```json
{
  "status": "ok",
  "message": "墨问心情分析服务运行中",
  "timestamp": "2026-04-02T10:00:00"
}
```

## 启动前端扩展

### 1. 安装 Node 依赖

```bash
cd extension
npm install
```

### 2. 开发模式

```bash
npm run dev
```

### 3. 构建生产版本

```bash
npm run build
```

## 安装 Chrome 扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目中的 `extension/dist` 目录

## API 接口

后端提供以下 API 接口：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/notes` | GET | 获取笔记列表 |
| `/api/notes/<id>` | GET | 获取单个笔记 |
| `/api/mood/analyze` | POST | 分析心情 |
| `/api/mood/history` | GET | 获取心情历史 |
| `/api/mood/trend` | GET | 获取心情趋势 |

## 技术栈

### 后端
- Flask 3.1.1
- Flask-CORS
- SQLite
- OpenAI SDK

### 前端
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts (图表)

### AI 服务
- 阿里云百炼 API (通义千问)
