# Local model diagnostic record

20 October 2026. These are small, machine-authored synthetic examples with subjective labels. They are **not independently labelled, representative, or evidence of general accuracy**. No 8 GB device was tested.

## Environment

- Apple M2 Max, 64 GB unified memory.
- Existing Ollama 0.33.1 service on loopback.
- Existing `Qwen3.5:latest`, reported 9.7B parameters, Q4_K_M; model file approximately 6.59 GB. The tag is mutable and this is not a minimum-model recommendation.
- JSON format, temperature 0, 4,096-token context, `think: false`.
- Evaluation sends one post per request with at most 200 output tokens. The extension batches up to four and allows 700 output tokens. These timings are not sustained feed throughput.

The initial live requests ran into the 15-second deadline while the model generated reasoning. Disabling optional thinking produced valid JSON in the diagnostic runs. The one-second UI deadline still releases the cover when inference is late.

## Observations

| Run | Cases | Label precision | Label recall | Failures | Median / p95 |
| --- | ---: | ---: | ---: | ---: | --- |
| Original prompt, calibration set | 16 | 3/7 | 3/4 | 0 | 2,175 / 2,427 ms |
| Prompt v2, same calibration set | 16 | 3/4 | 3/4 | 0 | 2,333 / 2,927 ms |
| Prompt v2, fresh challenge set | 12 | 3/3 | 3/4 | 0 | 2,231 / 4,498 ms |

The second row is tuning on the same examples; it is not independent validation. The 12 challenge cases were written after prompt v2 was frozen. Their tiny size and common authorship still prevent a generalisation claim. Do not turn the last row into “100% accurate” marketing.

The original prompt over-flagged a personal request for support, an AI-authorship claim, embedded instructions and generic motivational prose. Prompt v2 corrected several examples, but still called one generic motivational post suspected AI slop. Both v2 runs missed the ragebait label on a taunt while detecting its engagement-farming component.

The challenge set required abstention on two examples. The model abstained on the missing-video-context example but called generic motivational prose clear: **1/2 required abstentions**. A parser can enforce shape and suppress categories when context is missing; it cannot make a model's confident judgement true.

## Reproduce

```sh
MODEL_MODE=ollama MODEL_ENDPOINT=http://127.0.0.1:11434/api/chat MODEL_ID=Qwen3.5:latest npm run evaluate
MODEL_MODE=ollama MODEL_ENDPOINT=http://127.0.0.1:11434/api/chat MODEL_ID=Qwen3.5:latest npm run evaluate -- tests/evaluation-holdout.json artifacts/model-holdout.json
```

Use your exact installed model identifier. The harness counts expected labels on failed requests as missed labels and reports failures separately. API mode uses your chosen provider and credits; no remote provider was used for these results.

Raw reports: [before](evaluation/calibration-before.json), [after](evaluation/calibration-after.json), [challenge](evaluation/holdout.json). Dataset text is under `tests/`.

The next useful evaluation is independently reviewed public material spanning news, satire, distress, disagreement, languages and incomplete media, plus actual low-memory hardware. Further tuning to these same examples would not establish reliability.
