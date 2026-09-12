# AI tools disclosure

Project: Sentinel. Event: Frontier Cascadia, September 12, 2026. This file is required by the event rules and lists every AI tool the team used, who made it, the model, the paid tier, what it was used for, and what stayed with the humans. It is split into tools used to build the project and models that run inside it.

## Tools used to build

| Tool | Vendor | Model | Tier | Used for |
|---|---|---|---|---|
| Claude Code (terminal agent) | Anthropic | Claude Opus 5 | Anthropic Max subscription (paid) | Drafting the planning documents from the human spec, generating backend, simulator and frontend code, the design system, the 3D scenes, the hardware schematic SVG, the ESP32 firmware sketch, the Xenon BLE firmware and serial bridge, the ML trainer, the Gemini client, and first drafts of the submission text |
| Firecrawl MCP server | Firecrawl | none (search and page fetch, no generation) | Free tier | Web research for the prior-art section of `docs/NOVELTY.md`: product pages, docs and news for Meshtastic, PurpleAir, Watch Duty, Genasys, Dryad and the others cited there; Particle Device OS and Xenon BLE documentation |
| Exa MCP server | Exa | none (search and page fetch, no generation) | Free tier | Same research task: sources, FEMA IPAWS guidance, the RCW drill text, NFPA references |

## Models that run inside the product

| Tool | Vendor | Model | Tier | Used for |
|---|---|---|---|---|
| Gemini API | Google | `gemini-flash-lite-latest`, called over REST in JSON mode with a response schema | Free tier | At runtime only, on request: triage of free-text civilian reports (type, count, urgency, detected language, English summary with the reporter's words quoted), translation of a report, and rewriting a template situation brief into one paragraph. 8 s timeout, no retries, 20 calls a minute, results cached by input hash. When there is no `GEMINI_API_KEY`, or on any error, the same endpoints answer from deterministic keyword rules and label the result `fallback: keyword rules`. |
| Sentinel fire-vs-sky second opinion | ours | Multinomial logistic regression, 7 features, 4 classes, numpy; plus an EWMA drift detector | n/a, trained by us | Offline, per-node second opinion beside the rule engine and a maintenance hint for drifting sensors. Trained on 6,426 synthetic windows generated from our own simulator's sensor curves; 98.4% held-out accuracy on that synthetic data. Metadata, confusion matrix and limits at `GET /api/ml/model-card`. |

Neither model opens or closes an alert, resolves an incident, sends a message or dispatches anyone. The alert engine, the neighbour-median fire test, the trust score, the WEA draft template and the drill logic are deterministic rules with visible thresholds. Every model output carries `basis` (what produced it) and `human_decides` (who acts).

Gemini sees the reporter's free text and the structured report fields for triage, and a list of facts already pulled from the database for the brief. It does not receive student rosters, phone numbers, staff names beyond what a responder typed into a note, or raw sensor streams. Nothing is sent when the key is absent.

## Data that is not AI

`shared/campus.geojson` is Roosevelt High School and its surroundings, exported once from OpenStreetMap via Overpass on 2026-09-12. It is map data under the Open Database License, attributed on screen as "Map data © OpenStreetMap contributors". No AI produced or edited it.

No other AI tools were used. No image generators, no voice tools, no code completion plugins outside Claude Code, no AI in the demo video.

## How Claude Code was used

One orchestrating Claude Code session ran parallel subagents during the implementation window, one per module (backend core, alerts, drills, simulator, frontend areas, hardware docs, submission docs) and, later in the day, one each for the demo director, the map data, the Xenon firmware and bridge, the ML layer and the Gemini layer. Each subagent received a written section of `docs/BUILD_PLAN.md` naming the files it owned and the documents it had to follow. File ownership was fixed; a subagent that needed a change elsewhere appended a line to `docs/INTEGRATION_NOTES.md` for a human to apply. Adversarial review passes (`docs/review/`) were also run through Claude Code and their punch lists applied by hand.

The planning documents (`docs/CONTRACT.md`, `docs/DESIGN.md`, `docs/SIM_WORLD.md`, `docs/HARDWARE_3D.md`, `docs/NOVELTY.md`, `docs/BUILD_PLAN.md`) were drafted by Claude from `spec.md` and reviewed, corrected and re-ordered by the team before any code was generated.

## What was human-decided

- The product: what Sentinel is, who it is for, the four roles, the dual-use "earns its wall" strategy, the pricing model.
- `spec.md` in full: problem framing, hardware block diagram, pin map, power budget, BOM numbers, alert-engine rules and thresholds, trust-score layers and weights, the demo plan, the cut list.
- That rules keep authority over the model, that the model is trained on synthetic data and says so, and that Gemini annotates and never decides.
- Which boards to put on the table, that BLE stands in for LoRa, and what is labelled as placeholder on them.
- The pitch, the lines used with judges, and the judging strategy.
- Every honesty decision: what is simulated, how it is labelled, the statement that the production node is designed and not fabricated, the WEA "drafts, does not send" position.
- Review and acceptance of every generated file. Nothing shipped without a human opening it. Both Xenons were flashed and pressed by a human.

## Contact

Questions about this disclosure can go to the team through the Devpost project page.
