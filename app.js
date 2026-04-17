const SYSTEM_PROMPT = `You are a helpful assistant.
Answer naturally and directly.
Ask for clarification only when truly necessary.`;

const MODELS = [
  {
    id: "1.7b",
    name: "Bonsai 1.7B",
    params: "1.7B",
    repo: "onnx-community/Bonsai-1.7B-ONNX",
    size: "290 MB",
    note: "Pocket-class. Built for always-on local usage.",
    enabled: true,
  },
  {
    id: "4b",
    name: "Bonsai 4B",
    params: "4B",
    repo: "onnx-community/Bonsai-4B-ONNX",
    size: "584 MB",
    note: "Sweet spot for stronger reasoning on modern laptops.",
    enabled: true,
  },
  {
    id: "8b",
    name: "Bonsai 8B",
    params: "8B",
    repo: "onnx-community/Bonsai-8B-ONNX",
    size: "1.2 GB",
    note: "Largest model; heavy for browser memory budgets.",
    enabled: true,
  },
];

const state = {
  worker: null,
  selectedModelId: "1.7b",
  stage: "booting", // booting | loading | ready | error
  isStreaming: false,
  messages: [],
  activeAssistantEl: null,
  activeAssistantIndex: -1,
};

const els = {
  page: document.querySelector(".page"),
  playground: document.querySelector("#playground"),
  tryDemoButton: document.querySelector("#tryDemoButton"),
  webgpuBadge: document.querySelector("#webgpuBadge"),
  selectView: document.querySelector("#selectView"),
  loadingView: document.querySelector("#loadingView"),
  errorView: document.querySelector("#errorView"),
  chatView: document.querySelector("#chatView"),
  modelGrid: document.querySelector("#modelGrid"),
  loadModelButton: document.querySelector("#loadModelButton"),
  loadButtonLabel: document.querySelector("#loadButtonLabel"),
  loadTitle: document.querySelector("#loadTitle"),
  loadLabel: document.querySelector("#loadLabel"),
  loadPercent: document.querySelector("#loadPercent"),
  progressBar: document.querySelector("#progressBar"),
  errorText: document.querySelector("#errorText"),
  backButton: document.querySelector("#backButton"),
  selectedModelChip: document.querySelector("#selectedModelChip"),
  selectedSizeChip: document.querySelector("#selectedSizeChip"),
  chatLog: document.querySelector("#chatLog"),
  emptyState: document.querySelector("#emptyState"),
  composer: document.querySelector("#composer"),
  promptInput: document.querySelector("#promptInput"),
  sendButton: document.querySelector("#sendButton"),
  stopButton: document.querySelector("#stopButton"),
  resetButton: document.querySelector("#resetButton"),
  tpsChip: document.querySelector("#tpsChip"),
};

const selectedModel = () => MODELS.find((model) => model.id === state.selectedModelId);

function setWebgpuBadge(text, kind) {
  els.webgpuBadge.textContent = text;
  els.webgpuBadge.className = `status-pill ${kind}`;
}

function setLoadStatus(label, percent = 0) {
  const bounded = Math.max(0, Math.min(100, Number(percent) || 0));
  els.loadLabel.textContent = label;
  els.loadPercent.textContent = `${Math.round(bounded)}%`;
  els.progressBar.style.width = `${bounded}%`;
}

function syncSelectedModelUi() {
  const model = selectedModel();
  if (!model) return;
  els.loadButtonLabel.textContent = `Load ${model.name}`;
  els.selectedModelChip.textContent = model.name;
  els.selectedSizeChip.textContent = model.size;
  els.loadTitle.textContent = model.name;
}

function scrollChatToBottom() {
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function hideEmptyState() {
  if (els.emptyState) {
    els.emptyState.classList.add("hidden");
  }
}

function restoreEmptyState() {
  if (els.emptyState) {
    els.emptyState.classList.remove("hidden");
  }
}

function createMessage(role, content, stream = false) {
  hideEmptyState();

  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const roleEl = document.createElement("span");
  roleEl.className = "role";
  if (role === "user") {
    roleEl.textContent = "You";
  } else if (role === "assistant") {
    roleEl.textContent = selectedModel()?.name || "Assistant";
  } else {
    roleEl.textContent = "System";
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (stream) {
    bubble.classList.add("streaming");
  }
  bubble.textContent = content;

  wrapper.appendChild(roleEl);
  wrapper.appendChild(bubble);
  els.chatLog.appendChild(wrapper);
  scrollChatToBottom();
  return bubble;
}

function normalizeAssistantText(text) {
  if (!text) return "";
  let cleaned = text;
  cleaned = cleaned.replace(/^\s*assistant\s*:\s*/i, "");
  return cleaned;
}

function syncStageViews() {
  const selectVisible = true;
  const loadingVisible = state.stage === "loading";
  const errorVisible = state.stage === "error";
  const chatVisible = state.stage === "ready";

  els.selectView.classList.toggle("hidden", !selectVisible);
  els.loadingView.classList.toggle("hidden", !loadingVisible);
  els.errorView.classList.toggle("hidden", !errorVisible);
  els.chatView.classList.toggle("hidden", !chatVisible);
}

function setStage(stage) {
  state.stage = stage;
  syncStageViews();

  const ready = stage === "ready";
  const loading = stage === "loading";
  const canLoad = !!selectedModel()?.enabled && !loading && !state.isStreaming;

  els.loadModelButton.disabled = !canLoad;
  els.promptInput.disabled = !ready || state.isStreaming;
  els.sendButton.disabled = !ready || state.isStreaming;
  els.resetButton.disabled = !ready || state.isStreaming;
  els.stopButton.disabled = !ready || !state.isStreaming;
}

function updateModelCards() {
  els.modelGrid.innerHTML = "";

  for (const model of MODELS) {
    const card = document.createElement("button");
    card.type = "button";
    const active = model.id === state.selectedModelId;
    const disabled = !model.enabled;

    card.className = `model-card ${active ? "selected" : ""} ${disabled ? "disabled" : ""}`.trim();
    card.innerHTML = `
      ${disabled ? '<div class="mc-ribbon">Coming soon</div>' : ""}
      <div class="check" aria-hidden="true"></div>
      <div class="mc-size">${model.params}<span class="gb">${model.size}</span></div>
      <div class="mc-name">${model.name}</div>
      <div class="mc-blurb">${model.note}</div>
    `;

    card.addEventListener("click", () => {
      if (disabled) {
        setLoadStatus(`${model.name} is listed but not enabled yet.`, 0);
        return;
      }
      state.selectedModelId = model.id;
      syncSelectedModelUi();
      updateModelCards();
      if (state.stage !== "loading") {
        setLoadStatus(`Selected ${model.name}`, 0);
      }
      setStage(state.stage);
    });

    els.modelGrid.appendChild(card);
  }
}

function composeMessagesForModel() {
  const turns = state.messages
    .filter((x) => x.content?.length)
    .map((turn) => ({ role: turn.role, content: turn.content }))
    .slice(-24);

  return [{ role: "system", content: SYSTEM_PROMPT }, ...turns];
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GB`;
  return `${(value / 1e6).toFixed(0)} MB`;
}

function onWorkerMessage(event) {
  const payload = event.data;

  if (payload.status === "progress_total") {
    const loaded = Number(payload.loaded ?? 0);
    const total = Number(payload.total ?? 0);
    const percent = Number(payload.progress ?? 0);
    const bytes = total > 0 ? `${formatBytes(loaded)} / ${formatBytes(total)}` : "Preparing download";
    setLoadStatus(bytes, percent);
    return;
  }

  if (payload.status === "loading") {
    setLoadStatus(payload.data, Number(payload.progress ?? 0));
    return;
  }

  if (payload.status === "ready") {
    setStage("ready");
    els.playground.classList.add("load-moving");
    els.chatView.classList.add("stage-enter");
    window.setTimeout(() => {
      els.playground.classList.remove("load-moving");
      els.chatView.classList.remove("stage-enter");
    }, 900);
    setLoadStatus("Model ready", 100);
    els.tpsChip.textContent = "--";
    if (state.messages.length === 0) {
      restoreEmptyState();
    }
    els.promptInput.focus();
    return;
  }

  if (payload.status === "start") {
    state.isStreaming = true;
    state.messages.push({ role: "assistant", content: "" });
    state.activeAssistantIndex = state.messages.length - 1;
    state.activeAssistantEl = createMessage("assistant", "", true);
    setStage("ready");
    els.tpsChip.textContent = "...";
    return;
  }

  if (payload.status === "update") {
    if (!state.isStreaming || !state.activeAssistantEl) return;
    const index = state.activeAssistantIndex;
    if (index >= 0 && state.messages[index]) {
      state.messages[index].content += payload.output ?? "";
      const cleaned = normalizeAssistantText(state.messages[index].content);
      state.messages[index].content = cleaned;
      state.activeAssistantEl.textContent = cleaned;
    }
    if (payload.tps != null && Number.isFinite(payload.tps)) {
      els.tpsChip.textContent = `${payload.tps.toFixed(1)}`;
    }
    scrollChatToBottom();
    return;
  }

  if (payload.status === "complete") {
    state.isStreaming = false;
    if (state.activeAssistantEl) {
      state.activeAssistantEl.classList.remove("streaming");
    }
    state.activeAssistantEl = null;
    state.activeAssistantIndex = -1;
    setStage("ready");
    return;
  }

  if (payload.status === "checked") {
    setWebgpuBadge("WebGPU detected", "ok");
    setStage("booting");
    setLoadStatus("Pick a model to start.", 0);
    return;
  }

  if (payload.status === "error") {
    state.isStreaming = false;
    if (state.activeAssistantEl) {
      state.activeAssistantEl.classList.remove("streaming");
    }
    state.activeAssistantEl = null;
    state.activeAssistantIndex = -1;

    const message = String(payload.data || "Unknown error");

    if (payload.phase === "generate" || state.stage === "ready") {
      setStage("ready");
      createMessage("system", `Generation error: ${message}`);
      return;
    }

    els.errorText.textContent = message;
    setWebgpuBadge("WebGPU unavailable", "error");
    setStage("error");
  }
}

function startModelLoad() {
  const model = selectedModel();
  if (!model?.enabled) return;

  els.playground.classList.add("load-moving");
  setStage("loading");
  els.loadingView.classList.add("stage-enter");
  setLoadStatus("Fetching weights", 0);
  els.loadingView.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  window.setTimeout(() => {
    els.playground.classList.remove("load-moving");
    els.loadingView.classList.remove("stage-enter");
  }, 900);
  state.worker.postMessage({ type: "load", data: model.id });
}

function sendPrompt() {
  const text = els.promptInput.value.trim();
  if (!text || state.stage !== "ready" || state.isStreaming) return;

  state.messages.push({ role: "user", content: text });
  createMessage("user", text);
  els.promptInput.value = "";
  const modelInput = composeMessagesForModel();
  state.worker.postMessage({ type: "generate", data: modelInput });
  els.promptInput.focus();
}

function resetConversation() {
  state.messages = [];
  state.activeAssistantEl = null;
  state.activeAssistantIndex = -1;
  state.worker.postMessage({ type: "reset" });
  els.tpsChip.textContent = "--";

  const messageNodes = els.chatLog.querySelectorAll(".message");
  for (const node of messageNodes) {
    node.remove();
  }
  restoreEmptyState();
  els.promptInput.focus();
}

function wireEvents() {
  els.tryDemoButton.addEventListener("click", (event) => {
    event.preventDefault();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) {
      els.page.classList.add("cta-moving");
      els.selectView.classList.add("cta-enter");
    }

    els.playground.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });

    window.setTimeout(() => {
      els.page.classList.remove("cta-moving");
      els.selectView.classList.remove("cta-enter");
    }, 900);
  });

  els.loadModelButton.addEventListener("click", startModelLoad);

  els.backButton.addEventListener("click", () => {
    setStage("booting");
    setWebgpuBadge("WebGPU detected", "ok");
  });

  els.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendPrompt();
  });

  els.stopButton.addEventListener("click", () => {
    state.worker.postMessage({ type: "interrupt" });
  });

  els.resetButton.addEventListener("click", resetConversation);

  els.promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendPrompt();
    }
  });
}

function boot() {
  syncSelectedModelUi();
  updateModelCards();
  wireEvents();
  setStage("booting");
  setLoadStatus("Checking WebGPU support...", 0);

  state.worker = new Worker("./worker.js", { type: "module" });
  state.worker.addEventListener("message", onWorkerMessage);
  state.worker.postMessage({ type: "check" });
}

boot();
