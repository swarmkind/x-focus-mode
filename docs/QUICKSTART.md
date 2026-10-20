# A quieter feed, in four steps

## 1. Install the developer preview

Download and extract the ZIP from [GitHub Releases](https://github.com/swarmkind/x-focus-mode/releases). Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.

For an update, replace the extracted files, click **Reload** on the extension card, then reload X. Reloading X alone does not reliably reload an unpacked extension's updated scripts.

## 2. Choose a reviewer

- **My AI provider:** connect OpenRouter or enter an HTTPS OpenAI-compatible chat endpoint, model identifier and API key. Requests use your provider credits. A consumer chatbot subscription is not an API key.
- **Local Ollama:** follow the [local setup guide](OLLAMA.md). Ollama and the selected model must already be installed and running. This preview does not install them automatically.
- **Community flags only:** enter a compatible relay you run or trust. No model requests are made. No public Swarmkind relay is deployed yet, so this mode may have no reports to show.

## 3. Set your filters

Choose **Blur**, **Colour** or **Ignore** for each category. Add interests if you want personal highlights. “Suspected AI slop” is a content judgement, not proof that a person used AI.

**👎 Reject post** sits in the existing action row without adding post height. Click it, then choose a reason: Ragebait, Doomering, Engagement farming or Suspected AI slop. Your choice hides the post and is remembered on this device. When sharing is enabled and the post is eligible, choosing a reason also submits a human report.

**Reveal** floats over hidden content and shows it immediately; it does not endorse or publish a report. The small community count on 👎 stays visible after Reveal. Open the menu for details, **Hide this post**, or **Incorrect · show this post** to undo a mistaken label. Escape or scrolling dismisses the menu.

Community auto-blur starts off. If enabled, other people's reports can affect visibility; signed reports can still be mistaken or coordinated.

## 4. Review and enable

Read the data disclosure. Sharing and distribution start checked, but nothing activates before you accept and save. You can turn either off independently. Distribution can continue while Chrome runs, even with X closed.

Save, then reload your X home feed. Own posts, protected posts and excluded routes are skipped. If public visibility cannot be confirmed, remote AI and sharing skip the post; local review may still be available. If a model is slow, the temporary cover opens after one second. A late result adds a label without suddenly hiding text you have already seen.

## Data, briefly

API mode sends eligible text and interests to your configured provider. Local mode sends them to Ollama on this computer. Shared reports contain IDs, category codes, source/model, a pseudonymous signing key, signature, revision and expiry. They do not contain tweet text, handles, API keys, interests or reveal history.

Signing keys link contributions. Peers can see your public IP, relays can observe requests, and distributed copies can remain after withdrawal. See the [full privacy policy](PRIVACY.md).

## Help and support

File reproducible bugs at [GitHub Issues](https://github.com/swarmkind/x-focus-mode/issues), using synthetic examples rather than private feed content or credentials. Built by [@swarmkind](https://x.com/swarmkind).

The extension's Buy Me a Coffee button points to the **planned** `swarmkind` username at the author's request. It is visibly marked as coming soon; ownership is not yet established.
