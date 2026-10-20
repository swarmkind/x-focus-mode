# Where to introduce X Focus Mode

Research checked 20 October 2026. No posts or outreach have been sent. Recheck the community's sidebar and pinned rules before posting; moderator decisions can change.

Start with a small developer preview, collect compatibility reports, then broaden distribution after the live-X recording and installation flow are verified. The project currently has no public relay or Chrome Web Store listing.

## Recommended order

| Place | Fit and approach | Rules / primary source |
| --- | --- | --- |
| Your **@swarmkind** X audience | Show the actual Reveal interaction, link the repository, ask for a few testers. Keep known limitations beside the download. | [Your profile](https://x.com/swarmkind) |
| **r/chrome_extensions** | Best first community for extension-specific feedback. Use its Self Promotion flair where available. Ask about installation, feed compatibility and keyboard controls. | [Community and rules](https://www.reddit.com/r/chrome_extensions/): relevant extensions, no spam/misleading titles, no vote brigading. |
| **r/SideProject** | Show the problem, one interaction and what you built. Use the suggested `[Project name] - [Short description]` title format. Ask one concrete UX question. | [Community sidebar](https://old.reddit.com/r/SideProject/) welcomes constructive project feedback. |
| **r/LLMDevs** | A technical post about conservative classification, abstention and the cost of false positives. Include the small evaluation's provenance and failures, rather than advertising a headline accuracy score. | [Moderator policy](https://www.reddit.com/r/LLMDevs/comments/1mvuw5x/community_rule_update_clarifying_our/) allows free open-source projects without prior approval; commercial/open-core promotion has different rules. |
| **DEV Community**, `#showdev` / `#opensource` | A build article covering the extension architecture, instant Reveal, privacy boundaries and what broke on real X. The three guides can accompany it. | [Community](https://dev.to/t/community), [Code of Conduct](https://dev.to/code-of-conduct). Disclose AI assistance as required and follow its linked AI guidelines. |
| **Show HN**, after the preview is easy to try | A runnable project with source, concise installation and the author available to answer technical questions. Explain why the relay is bounded and why labels are not facts. | [Show HN requirements](https://news.ycombinator.com/showhn.html). [HN guidelines](https://news.ycombinator.com/newsguidelines.html) prohibit generated/AI-edited comments and posts and automated posting. **Daniel must write the submission and replies himself.** |

## Places to approach later

- **r/LocalLLaMA:** bring useful original local-model measurements after participating in the community. Current moderator removals cite limits on self-promotion and LLM-generated content. This is unsuitable for a cold launch blast. See this [moderator explanation](https://www.reddit.com/r/LocalLLaMA/comments/1wyjmzv/removed/).
- **r/chrome:** do not use for this promotion. Moderators direct extension promotion to r/chrome_extensions; see this [removal explanation](https://www.reddit.com/r/chrome/comments/1x8j4wi/removed/).
- Privacy and digital-wellbeing groups: request moderator guidance where required. Their subject matter does not automatically imply permission for promotional links.

## A small launch packet

Use the [social cover](../assets/launch/social-cover.png), [setup guide](../assets/launch/01-get-started.png), [controls guide](../assets/launch/02-you-stay-in-control.png), [data guide](../assets/launch/03-where-data-goes.png), [Quick start](QUICKSTART.md), and [test record](TESTING.md).

Describe these facts accurately:

- MIT source; unpacked Chrome developer preview.
- Personal API credits, existing local Ollama, or community-only mode.
- Immediate Reveal is independent of inference.
- Community auto-blur starts off. Reveal is not a human confirmation.
- No public bootstrap relay yet. Community-only mode needs a compatible relay.
- No one-click local installer, verified 8 GB result, independent security audit or production-scale swarm claim.
- Actual model mistakes remain. Signed warnings identify a publisher; they do not prove the claim or one-person-one-vote.

Useful feedback requests: Chrome/OS version, selected mode and model, reproducible synthetic example, whether a label was early or late, and which control failed. Never ask people to post API keys, private feed exports or account cookies.

## Publishing rhythm

Launch in one relevant community, answer its feedback, and improve the preview before the next post. Tailor each write-up to that community. Do not ask for upvotes, create synthetic endorsements, cross-post the same pitch everywhere or scrape member lists for outreach. Keep donations secondary; the coffee username is still unclaimed.

## Portfolio while the main website is unfinished

The public repository and release page are enough for the first launch. Pin this repository on the Swarmkind profile, put the social cover and finished real-tweet demo in its README, and link the release and test record. A small GitHub Pages portfolio can later collect multiple projects; it is optional work, not a launch dependency.
