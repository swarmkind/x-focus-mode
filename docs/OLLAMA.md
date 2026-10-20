# Local model setup

Ollama is optional. The extension does not install native software or download weights.

1. Install Ollama from [the official site](https://ollama.com/download).
2. Choose and download a model in Ollama. Start with a small quantised instruction model and test it on your own machine; this project has not established a minimum reliable model.
3. Keep Ollama on its default loopback interface. In X Focus Mode choose **Local Ollama model**.
4. Endpoint: `http://localhost:11434/api/chat`. Enter the exact installed model name (`ollama list` shows it).
5. Save settings and grant the extension loopback access. Accept the data-flow disclosure. Reload X.

The client asks for JSON, a 4,096-token context and at most 700 generated tokens per batch. Model families differ in JSON reliability, latency and memory requirements. Unknown/malformed output fails open. A model-file download size is not its full runtime RAM use.

## If Ollama refuses the browser origin

Follow [Ollama's browser-origin configuration](https://docs.ollama.com/faq). Allow only your extension's origin, `chrome-extension://YOUR_EXTENSION_ID`; find the ID on `chrome://extensions`. Restart Ollama after changing its environment. Do not expose Ollama on `0.0.0.0` or use a blanket wildcard origin to make a browser extension work.

## 8 GB machines

Local hosting may be practical with a small quantised model, but browser memory, model context, operating system and GPU sharing all matter. This preview was tested on a 64 GB Mac, not an 8 GB device. A 2B-class model is a candidate to evaluate, not a proven minimum or recommendation that accuracy is sufficient. Keep the browser responsive, watch memory pressure, and choose community-only/API mode if local inference is slow. The one-second checking deadline still reveals unreviewed content while inference continues.

## Measure before choosing

Run the synthetic evaluation harness with your installed model:

```sh
MODEL_MODE=ollama MODEL_ENDPOINT=http://localhost:11434/api/chat MODEL_ID=YOUR_MODEL npm run evaluate
```

The small fixture is machine-authored and only a starting point. Add independently reviewed news, satire, quotes, ambiguous posts and language-specific examples. Report precision, recall, abstention and latency; high abstention can be preferable to confidently hiding ordinary speech.
