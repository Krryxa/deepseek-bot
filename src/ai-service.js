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
            content: "你是一个专业的技术助手，回答需准确且包含示例代码",
          },
        ],
        lastActive: Date.now(),
      });
    }
    return this.sessions.get(sessionId);
  }

  // 处理用户消息
  async processMessage(sessionId, userInput) {
    const session = this.getSession(sessionId);

    try {
      // 添加用户消息
      session.messages.push({
        role: "user",
        content: this.truncateMessage(userInput),
      });

      // 调用API
      const aiResponse = await this.callAPI(session.messages);

      // 添加AI回复
      session.messages.push({
        role: "assistant",
        content: aiResponse,
      });

      // 清理历史
      this.trimHistory(session.messages);

      return {
        success: true,
        response: aiResponse,
        sessionId: sessionId,
      };
    } catch (error) {
      // 回滚用户消息
      session.messages.pop();
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 调用DeepSeek API
  async callAPI(messages) {
    const response = await axios.post(
      this.config.endpoint,
      {
        model: this.config.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content;
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
