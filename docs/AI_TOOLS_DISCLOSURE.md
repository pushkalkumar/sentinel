# AI tools disclosure

Project: Sentinel. Event: Frontier Cascadia, September 12, 2026. This file is required by the event rules and lists every AI tool the team used during the build, who made it, the model, the paid tier, what it was used for, and what stayed with the humans.

## Tools used

| Tool | Vendor | Model | Tier | Used for |
|---|---|---|---|---|
| Claude Code (terminal agent) | Anthropic | Claude Opus 5 | Anthropic Max subscription (paid) | Drafting the planning documents from the human spec, generating backend, simulator and frontend code, the design system, the hardware schematic SVG and firmware sketch, and the first drafts of the submission text |
| Firecrawl MCP server | Firecrawl | none (search and page fetch, no generation) | `[team to confirm: free or paid tier before upload]` | Web research for the prior-art section of `docs/NOVELTY.md`: fetching product pages, docs and news articles for Meshtastic, PurpleAir, Watch Duty, Genasys, Dryad and the others cited there |
| Exa MCP server | Exa | none (search and page fetch, no generation) | `[team to confirm: free or paid tier before upload]` | Same research task: finding sources, FEMA IPAWS guidance, the RCW drill text, NFPA references |

No other AI tools were used. No image generators, no voice tools, no code completion plugins outside Claude Code, no AI in the demo video.

## How Claude Code was used

One orchestrating Claude Code session ran thirteen parallel subagents during the implementation window, one per module (backend core, alerts, drills, simulator, six frontend areas, hardware docs, submission docs). Each subagent received a written section of `docs/BUILD_PLAN.md` naming the files it owned and the documents it had to follow. File ownership was fixed; a subagent that needed a change elsewhere appended a line to `docs/INTEGRATION_NOTES.md` for a human to apply.

The planning documents (`docs/CONTRACT.md`, `docs/DESIGN.md`, `docs/SIM_WORLD.md`, `docs/HARDWARE_3D.md`, `docs/NOVELTY.md`, `docs/BUILD_PLAN.md`) were drafted by Claude from `spec.md` and reviewed, corrected and re-ordered by the team before any code was generated.

## What was human-decided

- The product: what Sentinel is, who it is for, the four roles, the dual-use "earns its wall" strategy, the pricing model.
- `spec.md` in full: problem framing, hardware block diagram, pin map, power budget, BOM numbers, alert-engine rules and thresholds, trust-score layers and weights, the demo plan, the cut list.
- The pitch, the lines used with judges, and the judging strategy (which awards to target, which to skip, what to say to whom).
- Every honesty decision: what is simulated, how it is labelled, the statement that hardware is designed and not fabricated, the WEA "drafts, does not send" position.
- Review and acceptance of every generated file. Nothing shipped without a human opening it.

## What the product does not do

No AI model runs inside Sentinel. The alert engine, the neighbour-median fire test, the trust score, the WEA draft template and the drill logic are deterministic rules with visible thresholds. No LLM API is called at runtime, in the demo or in the intended product.

## Contact

Questions about this disclosure can go to the team through the Devpost project page.
