import {
  InterruptableStoppingCriteria,
  TextStreamer,
  env,
  pipeline,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.1.0";

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_MAP = {
  "1.7b": { id: "onnx-community/Bonsai-1.7B-ONNX", dtype: "q1" },
  "4b": { id: "onnx-community/Bonsai-4B-ONNX", dtype: "q1" },
  "8b": { id: "onnx-community/Bonsai-8B-ONNX", dtype: "q1" },
};

class GeneratorStore {
  static cache = new Map();

  static async get(modelKey, progressCallback) {
    if (!this.cache.has(modelKey)) {
      const spec = MODEL_MAP[modelKey];
      if (!spec) {
        throw new Error(`Unknown model key: ${modelKey}`);
      }

      const loader = pipeline("text-generation", spec.id, {
        device: "webgpu",
        dtype: spec.dtype,
        progress_callback: progressCallback,
      });
      this.cache.set(modelKey, loader);
    }
    return this.cache.get(modelKey);
  }
}

let currentModel = null;
const stopper = new InterruptableStoppingCriteria();

async function checkWebGpu() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) {
      throw new Error("No WebGPU adapter found. Use a current Chrome, Edge, or Safari build.");
    }
    self.postMessage({ status: "checked" });
  } catch (error) {
    self.postMessage({ status: "error", phase: "check", data: String(error) });
  }
}

async function loadModel(modelKey) {
  try {
    currentModel = modelKey;

    self.postMessage({ status: "loading", data: "Loading model metadata..." });

    const generator = await GeneratorStore.get(modelKey, (info) => {
      if (info.status === "progress_total") {
        self.postMessage({
          status: "progress_total",
          progress: Number(info.progress ?? 0),
          loaded: Number(info.loaded ?? 0),
          total: Number(info.total ?? 0),
        });
      }
    });

    self.postMessage({ status: "loading", data: "Compiling WebGPU graph..." });

    const warmupInput = generator.tokenizer("a");
    await generator.model.generate({ ...warmupInput, max_new_tokens: 1 });
    self.postMessage({ status: "ready" });
  } catch (error) {
    self.postMessage({ status: "error", phase: "load", data: String(error) });
  }
}

async function generate(messages) {
  if (!currentModel) {
    self.postMessage({ status: "error", data: "No model loaded yet." });
    return;
  }

  try {
    const generator = await GeneratorStore.get(currentModel);
    let input = messages;
    if (Array.isArray(messages)) {
      if (typeof generator.tokenizer.apply_chat_template === "function") {
        input = generator.tokenizer.apply_chat_template(messages, {
          tokenize: false,
          add_generation_prompt: true,
        });
      } else {
        input = messages.map((m) => `${m.role}: ${m.content}`).join("\n") + "\nassistant:";
      }
    }

    let startTime = null;
    let tokenCount = 0;
    let tps = null;

    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (output) => {
        self.postMessage({ status: "update", output, tps });
      },
      token_callback_function: () => {
        startTime ??= performance.now();
        tokenCount += 1;
        const elapsed = performance.now() - startTime;
        if (elapsed > 0 && tokenCount > 1) {
          tps = (tokenCount * 1000) / elapsed;
        }
      },
    });

    self.postMessage({ status: "start" });

    await generator(input, {
      max_new_tokens: 256,
      do_sample: false,
      streamer,
      stopping_criteria: stopper,
      return_full_text: false,
    });

    self.postMessage({ status: "complete" });
  } catch (error) {
    const message = String(error);
    if (message.toLowerCase().includes("interrupt")) {
      self.postMessage({ status: "complete" });
      return;
    }
    self.postMessage({ status: "error", phase: "generate", data: message });
  }
}

self.addEventListener("message", async (event) => {
  const { type, data } = event.data;

  if (type === "check") {
    await checkWebGpu();
    return;
  }

  if (type === "load") {
    await loadModel(data);
    return;
  }

  if (type === "generate") {
    stopper.reset();
    await generate(data);
    return;
  }

  if (type === "interrupt") {
    stopper.interrupt();
    return;
  }

  if (type === "reset") {
    stopper.reset();
  }
});
