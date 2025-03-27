
let isRendering = false;

// 节流渲染函数：markdown-it 会自动处理未闭合标签，输出完整闭合标签的 dom 结构
const renderMarkdown = _.throttle((targetElement) => {
  if (!buffer || isRendering) return;

  isRendering = true;

  // 渲染 Markdown
  targetElement.innerHTML = md.render(buffer);

  // 高亮代码块
  targetElement.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });

  // 保持滚动到底部
  handleScrollBottom();

  isRendering = false;
}, 100);


// 节流渲染函数：分段渲染，未闭合标签追加文本形式渲染
const renderMarkdownSplit = _.throttle((targetElement) => {
  if (!buffer || isRendering) return;

  isRendering = true;

  // 处理未闭合的代码块
  const lastCodeBlock = buffer.lastIndexOf("```");
  let safeContent = buffer;
  let remaining = "";

  if (lastCodeBlock !== -1 && (buffer.match(/```/g) || []).length % 2 !== 0) {
    safeContent = buffer.substring(0, lastCodeBlock);
    remaining = buffer.substring(lastCodeBlock);
  }

  // 累积安全缓冲区
  fullBuffer += safeContent;

  // 渲染 Markdown
  targetElement.innerHTML = md.render(fullBuffer) + remaining;

  // 高亮代码块
  targetElement.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });

  // 保持滚动到底部
  handleScrollBottom();

  // 未处理缓冲区
  buffer = remaining;
  isRendering = false;
}, 100);
