const axios = require("axios");

class AIService {
  constructor(apiKey) {
    this.config = {
      apiKey,
      endpoint: "https://api.deepseek.com/chat/completions",
      model: "deepseek-chat",
      maxHistory: 10, // 保留最近5轮对话
    };

    // 会话存储（生产环境建议用Redis）
    this.sessions = new Map();
  }

  // 获取或创建会话
  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        messages: [
          {
            role: "system",
            content: "你是一个AI，满足用户的个性化需求，并做出相应的回复",
          },
        ],
        lastActive: Date.now(),
      });
    }
    return this.sessions.get(sessionId);
  }

  // 处理用户消息
  async processMessage(sessionId, userInput, onData) {
    const session = this.getSession(sessionId);

    try {
      // 添加用户消息
      session.messages.push({
        role: "user",
        content: this.truncateMessage(userInput),
      });

      // 添加空的assistant占位消息
      session.messages.push({
        role: "assistant",
        content: "", // 初始为空
      });
      const assistantIndex = session.messages.length - 1; // 记录占位位置

      // 调用API（流式）
      const finalContent = await this.callAPI(
        session.messages.slice(0, -1), // 排除占位消息
        (chunk) => onData(chunk)
      );

      // 流式结束后更新占位消息内容
      session.messages[assistantIndex].content = finalContent;
      this.trimHistory(session.messages);

      return { success: true, sessionId };
    } catch (error) {
      // 回滚：移除用户消息和占位消息
      session.messages.pop();
      session.messages.pop();
      return { success: false, error: error.message };
    }
  }

  // 调用DeepSeek API
  async callAPI(messages, onDataCallback) {
    const response = await axios.post(
      this.config.endpoint,
      {
        model: this.config.model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
      }
    );

    return new Promise((resolve, reject) => {
      let fullContent = "";

      response.data.on("data", (chunk) => {
        // 按行分割
        const lines = chunk.toString().split("\n").filter((line) => line.trim());

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data: ")) {
            // console.log("跳过非数据行:", trimmedLine); // 调试日志
            continue;
          }

          const message = trimmedLine.replace(/^data: /, "");
          if (message === "[DONE]") {
            response.data.destroy(); // 显式关闭流
            resolve(fullContent);
            return;
          }

          try {
            const parsed = JSON.parse(message);
            const chunkContent = parsed.choices[0]?.delta?.content || "";
            fullContent += chunkContent;
            onDataCallback(chunkContent); // 推送数据块
          } catch (parseError) {
            console.error("解析错误:", parseError, "原始数据:", message);
          }
        }
      });

      response.data.on("end", () => {
        resolve(fullContent);
      });

      response.data.on("error", (error) => {
        console.error("流式响应错误:", error);
        reject(error);
      });
    });
  }

  // 历史消息截断
  trimHistory(messages) {
    const systemMsg = messages[0];
    messages.splice(1, messages.length - this.config.maxHistory - 1);
  }

  // 消息长度限制
  truncateMessage(content, maxLength = 2000) {
    return content.length > maxLength
      ? content.substring(0, maxLength) + "...（截断）"
      : content;
  }

  // 清理过期会话
  cleanupSessions(maxInactiveMinutes = 30) {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActive > maxInactiveMinutes * 60 * 1000) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

module.exports = AIService;
