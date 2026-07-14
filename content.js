chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "GET_PAGE_TEXT") return;

  const selection = window.getSelection()?.toString().trim() || "";
  const pageText = collectReadableText();

  sendResponse({ selection, pageText });
});

function collectReadableText() {
  const selectors = ["article", "main", "[role='main']", ".post", ".entry-content", ".content"];

  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const text = normalizeText(node?.innerText || "");
    if (text.length > 300) return text.slice(0, 16000);
  }

  return normalizeText(document.body?.innerText || "").slice(0, 16000);
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}
