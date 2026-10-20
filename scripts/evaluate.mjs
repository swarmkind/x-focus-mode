import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  SYSTEM_PROMPT,
  parseAssessments,
  endpointURL,
} from "../shared/model.ts";
const mode = process.env.MODEL_MODE || "ollama",
  model = process.env.MODEL_ID;
if (!model)
  throw new Error(
    "Set MODEL_ID. This harness uses your selected provider and may consume its credits.",
  );
const endpoint = endpointURL(
  process.env.MODEL_ENDPOINT || "http://localhost:11434/api/chat",
  mode === "ollama",
);
const datasetPath = process.argv[2] || "tests/evaluation.json";
const outputPath = process.argv[3] || "artifacts/model-evaluation.json";
const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const results = [];
let tp = 0,
  fp = 0,
  fn = 0,
  abstained = 0,
  failures = 0,
  expectedAbstentions = 0,
  correctAbstentions = 0;
for (const item of dataset.cases) {
  if (item.abstain) expectedAbstentions++;
  const start = performance.now();
  try {
    const post = {
      id: item.id,
      text: item.text,
      contextIncomplete: !!item.contextIncomplete,
    };
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ interests: "", posts: [post] }),
      },
    ];
    const body =
      mode === "ollama"
        ? {
            model,
            messages,
            stream: false,
            think: false,
            format: "json",
            options: { temperature: 0, num_ctx: 4096, num_predict: 200 },
          }
        : {
            model,
            messages,
            temperature: 0,
            max_tokens: 200,
            response_format: { type: "json_object" },
          };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.MODEL_KEY
          ? { Authorization: `Bearer ${process.env.MODEL_KEY}` }
          : {}),
      },
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error("Provider response " + response.status);
    const data = await response.json();
    const a = parseAssessments(
      mode === "ollama"
        ? data.message.content
        : data.choices[0].message.content,
      [post],
    ).get(item.id);
    if (a.confidence === "uncertain" || a.needsContext) {
      abstained++;
      if (item.abstain) correctAbstentions++;
    }
    for (const c of a.categories) {
      if (item.categories.includes(c)) tp++;
      else fp++;
    }
    for (const c of item.categories) if (!a.categories.includes(c)) fn++;
    results.push({
      id: item.id,
      assessment: a,
      ms: Math.round(performance.now() - start),
    });
  } catch {
    failures++;
    fn += item.categories.length;
    results.push({
      id: item.id,
      error: "No valid assessment",
      ms: Math.round(performance.now() - start),
    });
  }
}
const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
const report = {
  provenance: dataset.provenance,
  dataset: datasetPath,
  model,
  date: new Date().toISOString(),
  examples: results.length,
  precision: tp + fp ? tp / (tp + fp) : null,
  recall: tp + fn ? tp / (tp + fn) : null,
  abstention: abstained / results.length,
  requiredAbstentionRecall: expectedAbstentions
    ? correctAbstentions / expectedAbstentions
    : null,
  failures,
  p50ms: latencies[Math.floor(latencies.length * 0.5)],
  p95ms:
    latencies[
      Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))
    ],
  results,
};
await mkdir("artifacts", { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
