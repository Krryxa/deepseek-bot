require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const AIService = require("./ai-service");

// 初始化
const app = express();
const aiService = new AIService(process.env.DEEPSEEK_API_KEY);

// 中间件
app.use(express.json());

// 会话中间件
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Max-Age", "86400"); // 缓存 24 小时，减少 OPTIONS 预检请求
  req.sessionId = req.headers["x-session-id"] || uuidv4();
  next();
});

// 聊天接口
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid message format" });
    }

    // 设置流式响应头
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // 流式处理
    await aiService.processMessage(req.sessionId, message, (chunk) => {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    });

    // 结束标记
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

// 定时清理会话
setInterval(() => {
  aiService.cleanupSessions();
}, 5 * 60 * 1000); // 5分钟

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
