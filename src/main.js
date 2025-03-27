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

    const result = await aiService.processMessage(req.sessionId, message);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      sessionId: req.sessionId,
      response: result.response,
    });
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
