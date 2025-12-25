// DOM Elements
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const clearKeyBtn = document.getElementById('clearKeyBtn');
const errorBanner = document.getElementById('errorBanner');
const errorText = document.getElementById('errorText');
const messagesContainer = document.getElementById('messagesContainer');
const messages = document.getElementById('messages');
const emptyState = document.getElementById('emptyState');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

let chatHistory = [];
let isLoading = false;

// INIT
function init() {
  loadApiKey();
  loadChatHistory();
  setupEventListeners();
}

// API KEY
function loadApiKey() {
  const savedKey = localStorage.getItem('gemini_api_key');

  if (savedKey) {
    apiKeyInput.value = savedKey;
    updateKeyStatus(true);
  } else {
    apiKeyInput.value = "";
    updateKeyStatus(false);
  }
}

function saveApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) return showError('Please enter a valid API key');

  localStorage.setItem('gemini_api_key', key);
  updateKeyStatus(true);
}

function clearApiKey() {
  localStorage.removeItem('gemini_api_key');
  apiKeyInput.value = "";
  updateKeyStatus(false);
}

function updateKeyStatus(hasKey) {
  if (hasKey) {
    statusDot.classList.add('active');
    statusText.textContent = 'API key configured';
  } else {
    statusDot.classList.remove('active');
    statusText.textContent = 'No API key saved';
  }

  clearKeyBtn.style.display = 'block';
}

// CHAT HISTORY
function loadChatHistory() {
  const saved = localStorage.getItem('dsa_chat_history');
  if (saved) chatHistory = JSON.parse(saved);
  renderMessages();
}

function saveChatHistory() {
  localStorage.setItem('dsa_chat_history', JSON.stringify(chatHistory));
}

// RENDERING
function renderMessages() {
  if (!chatHistory.length) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  messages.innerHTML = '';

  chatHistory.forEach(m =>
    messages.appendChild(createMessageElement(m.role, m.content))
  );

  scrollToBottom();
}

function createMessageElement(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '👤' : '🧠';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = formatMessage(content);

  div.append(avatar, bubble);
  return div;
}

function formatMessage(content) {
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Formatting helpers
  formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'message bot';
  div.id = 'typingIndicator';

  div.innerHTML = `
    <div class="avatar">🧠</div>
    <div class="bubble">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>`;

  messages.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ERRORS
function showError(msg) {
  errorText.textContent = msg;
  errorBanner.classList.add('show');
}

function hideError() {
  errorBanner.classList.remove('show');
}

// SIMPLE DSA CHECK
const dsaKeywords = [
  "array", "linked list", "tree", "graph", "heap", "stack", "queue",
  "sort", "search", "big o", "algorithm", "recursion", "dp", "dynamic programming"
];

function isDSARelated(text) {
  const t = text.toLowerCase();
  return dsaKeywords.some(k => t.includes(k));
}

// API CALL 
async function sendMessage(userMessage) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) return showError("Please save your Gemini API key first");

  hideError();
  isLoading = true;
  sendBtn.disabled = true;

  // 1. Add User Message to History
  chatHistory.push({ role: 'user', content: userMessage });
  saveChatHistory();
  renderMessages();

  addTypingIndicator();

  try {
    // 2. Prepare History (Slice last 10 turns)
    // NOTE: 'chatHistory' ALREADY contains the new userMessage we just pushed above.
    const recent = chatHistory.slice(-10);

    const systemPrompt = isDSARelated(userMessage)
      ? "You are a DSA instructor. Explain clearly with examples."
      : "User is off topic. Be playful, slightly rude, and redirect to DSA.";

    // 3. Build Contents
    // We Map 'recent' to the API format. We do NOT append userMessage again manually.
    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...recent.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }))
    ];

    // 4. Send Request (Using gemini-2.5-flash)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("API Error:", data);
      throw new Error(data.error?.message || "Unknown API error");
    }

    removeTypingIndicator();

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I couldn't generate a response.";

    // 5. Save and Render Bot Reply
    chatHistory.push({ role: "bot", content: reply });
    saveChatHistory();
    renderMessages();

  } catch (error) {
    removeTypingIndicator();
    console.error(error);
    showError(error.message);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
  }
}

// EVENTS
function setupEventListeners() {
  saveKeyBtn.onclick = saveApiKey;
  clearKeyBtn.onclick = clearApiKey;

  sendBtn.onclick = () => {
    const msg = chatInput.value.trim();
    if (!msg || isLoading) return;
    chatInput.value = "";
    sendMessage(msg);
  };

  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });
}

init();