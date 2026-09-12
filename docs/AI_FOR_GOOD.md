# Sentinel and the "AI for Good" question

One page for judges. Short version: the alerts are decided by rules you can read. A small model sits beside them as a second opinion, and it says so on every output.

## What the AI is

Two small, offline pieces, both in `backend/app/ml/`:

1. **Fire-vs-sky second opinion.** A multinomial logistic regression over seven features computed from a node's last 30 minutes and its neighbours: `pm25`, `pm_rise_5m`, `temp_rise_2m`, `gas_delta`, `ratio_to_neighbour_median`, `neighbour_spread`, `rh_drop`. It returns probabilities for `fire`, `sky`, `clear`, `suspect`. Numpy only, no GPU, no network, under a millisecond per node.
2. **Per-node drift detector.** An EWMA of "this node minus the median of its neighbours" over 30 minutes, scored as a robust z (MAD). A node that sits 30 µg/m³ above its neighbours for half an hour without moving is a dirty inlet or a drifting PMS5003, not a fire. It flags; it does not correct.

Training data is generated from the simulator's own sensor curves (`simulator/world.py`): calm mornings, the scripted smoke afternoon, forced regional smoke, fires at every node at several ages, across seeds, tick spacings and noise levels. Labels are the scenario that produced the window, not the rule engine's verdict, so the model is not a copy of the rules. Full metadata (sample count, held-out accuracy, confusion matrix, date) ships in `weights.json` and at `GET /api/ml/model-card`.

## What it is not

- It is not an LLM. Nothing in the alert path calls a language model.
- It does not open or close alerts. `app.alerts.engine` does, with four if-statements a fire marshal can read.
- It is not trained on real fires. Every sample is synthetic. The `suspect` class comes from a PM-only bump we added ourselves; the simulator has no such scenario.
- It is not calibrated to any real base rate. A 0.93 means "0.93 in the synthetic world".

## Honest limits

- Synthetic data, one simulated campus and one warehouse. Real buildings have HVAC, kitchens, shop classes and vape pens. Expect false positives and recalibrate on real logs before trusting the probabilities.
- Seven hand-picked features; no raw waveform, camera or audio. If a fire does not move PM, heat or gas at a node, neither the rules nor the model see it.
- Cheap sensors. The MQ-2 has poor selectivity; the PMS5003 drifts. The drift detector makes this visible, nothing more.
- Class imbalance in training (sky and clear dominate); the trainer reweights classes and reports the confusion matrix rather than hiding behind one accuracy number.

## How a principal sees it

The console calls `GET /api/ml/assess-all?site_id=`. Each node row shows the rule branch that is actually open, the model's top class, and an `agreement` flag. Agreement is quiet. Disagreement is a prompt to look, not an alarm: "the rules say clear, the model leans suspect at the science room" is something a person walks over to check. Every payload carries `basis` (what the model is and what it was trained on) and `human_decides` (who acts). The drift note is the maintenance hint: "check the sensor in the gym".

## Why rules keep authority

- **Auditability.** A school, a warehouse insurer or a fire marshal can read the four rules and their thresholds. They cannot read 32 coefficients.
- **Failure modes are visible.** A rule fails loudly on a missing reading. A model fails quietly, with confidence.
- **Liability follows the decision.** If a box tells 400 children to evacuate, the reason must be a sentence, and it is: "PM2.5 rose 180 in 5 min with +6 °C; neighbours at 75."
- **The model earns trust by agreeing.** Running beside the rules for a season produces the disagreement log that would justify giving it more weight later. Today it has none.

Endpoints: `GET /api/ml/model-card`, `GET /api/ml/assess?node_id=`, `GET /api/ml/assess-all?site_id=`. Retrain with `cd backend && .venv/bin/python -m app.ml.train`.
