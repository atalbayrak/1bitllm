# 1bitllm

Static WebGPU chat playground for Bonsai models.

## What it does

- Loads `onnx-community/Bonsai-1.7B-ONNX` directly in-browser with WebGPU.
- Streams responses token-by-token in a chat UI.
- Keeps Bonsai 4B and 8B visible in the app as future options.
- Links to the original GGUF repos:
  - https://huggingface.co/prism-ml/Bonsai-8B-gguf
  - https://huggingface.co/prism-ml/Bonsai-4B-gguf
  - https://huggingface.co/prism-ml/Bonsai-1.7B-gguf

## Run locally

Use a local server (module workers do not run from plain `file://` URLs):

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## Notes

- First run downloads and caches model files.
- WebGPU support is required (modern Chrome, Edge, or Safari).
- The demo enables 1.7B by default to keep memory usage practical.
