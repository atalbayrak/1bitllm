# 1bitllm

Minimal static website for GitHub Pages that links to:

- https://huggingface.co/prism-ml/Bonsai-8B-gguf
- https://huggingface.co/prism-ml/Bonsai-4B-gguf
- https://huggingface.co/prism-ml/Bonsai-1.7B-gguf

## Run locally

Open `index.html` directly or run:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy on GitHub Pages

1. Go to **Settings → Pages**.
2. Set **Source** to **Deploy from a branch**.
3. Select your branch and `/ (root)` folder.
4. Save and wait for deployment.
