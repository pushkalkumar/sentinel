# Judge Q&A

Eighteen questions we expect, each with a two-sentence answer. Say the answer, then stop; let the judge ask the follow-up.

**1. Isn't this Dryad Silvanet?**
Dryad proves that cheap gas-sensor meshes find fires early, and they put an ML model in each sensor because a forest has no false alarms from the sky. We put the intelligence between the sensors, comparing each node against its neighbours' median, because in a schoolyard or a warehouse the sky itself is the false alarm, and we add inbound verified reports, roles and daily use that Dryad does not have.

**2. Isn't the mesh just Meshtastic?**
Yes, the radio layer is the same design family: LoRa flooding with de-duplication, TTL and store-and-forward, and we would happily build on their firmware. Meshtastic carries whatever anyone sends and is spoofable by design; Sentinel adds the sensor baseline, the trust score and a responder console on top, which is where the product lives.

**3. Can you really text every phone in the area?**
No, and we say so on screen: alerting every phone is Wireless Emergency Alerts through FEMA's IPAWS, which only authorised agencies can issue. Sentinel sends to an opt-in registry per zone, pushes the alert to every phone joined to a node, and drafts the CAP-shaped WEA message so the agency's text is already written when they log in.

**4. Cheap PM sensors drift. How do you trust them?**
They do, and the PMS5003 also needs cleaning; we do not pretend otherwise. Because every decision is a comparison against neighbours, a drifting node shows up as an outlier without heat or gas, and the drift detector puts a "check the sensor" note on that node rather than calling a fire.

**5. Student rosters and parent phone numbers: FERPA, TCPA?**
Both apply and neither is built today: the SMS registry needs TCPA-compliant opt-in and STOP handling, and roster data needs a data processing agreement with the district under FERPA. The architecture keeps roster data on the school's edge server and sends only class counts and missing-student references upward, which is the shape those agreements want.

**6. How far does this scale?**
A flooding mesh holds about 50 to 80 nodes per LoRa channel at five-minute telemetry before airtime collisions climb, so a large site splits by channel or adds gateways, each anchoring its own segment. The backend is stateless FastAPI with tenant-partitioned Postgres and Redis fan-out; the demo swaps Postgres for SQLite and the rest of the code path is the same.

**7. Why do the rules decide instead of the model?**
A school, an insurer or a fire marshal can read four if-statements and their thresholds; they cannot read 32 coefficients, and if a box tells 400 children to evacuate the reason has to be a sentence. A rule fails loudly on a missing reading while a model fails quietly with confidence, so the model runs beside the rules, logs where it disagrees, and earns more weight only after a season of that log exists.

**8. What was the model trained on?**
Synthetic windows only: 6,426 samples generated from our own simulator's sensor curves, calm mornings, the scripted smoke afternoon, fires at every node at several ages, across seeds and noise levels, plus one PM-only bump we added for the "suspect" class. Labels are the scenario that produced the window, not the rule engine's verdict, so it is not a copy of the rules; the 98.4% held-out number is accuracy on that synthetic world and the model card says it has never seen a real fire.

**9. What does Gemini see, and what can it do?**
It sees the free text of a civilian report with its type and count, or a list of facts already pulled from the database for the brief; it never sees rosters, phone numbers or raw sensor streams. It returns structured JSON, it cannot open, close or dispatch anything, and if the key is missing or it times out the same endpoint answers from keyword rules and labels itself as the fallback.

**10. Why $31? What is in that number?**
That is the BOM at 1,000 units including $2.50 of assembly and test: ESP32-S3, SX1262 LoRa, PMS5003, BME280, MQ-2, an 18650 cell, charger and boost, a 2 W panel, PCB, enclosure. At quantity one it is about $60, and the indoor mains-powered variant drops about $6 by losing the panel and the duty-cycling hardware.

**11. Why schools first and not warehouses, where the money is?**
Schools are the distribution story: Washington requires a drill every month, smoke season forces a daily outdoor decision, and the buyer is a CTIO who already runs the building's WiFi. Warehouses are the revenue story, at $25 per node per year plus a responder integration fee, and one prevented pallet fire pays for the building.

**12. What stops someone from spamming "trapped"?**
Nothing stops them from pressing the button, but the score tells the responder what to trust: proximity to a node, sensor corroboration, a second device, a verified role, GPS consistency and device history all add or subtract. Three confirmed false reports block the device, and internet-only reports with no node stamp never rise above Likely.

**13. How does a phone reach the node with no internet?**
The ESP32 runs its own access point, like a phone hotspot, and a tiny DNS server on it answers every hostname with the node's own address, so the phone opens the sign-in page automatically the way hotel WiFi does. Today's demo stands in for that with the laptop's hotspot, and the page says so.

**14. What is real in this demo and what is simulated?**
Simulated and labelled on screen: the sensors on the virtual nodes, the LoRa radio (local UDP with 15% drop), the SMS provider and the node's captive portal; the two Xenons are real boards sending the real message format over BLE with placeholder sensor values. Real: the alert engine and thresholds, the neighbour-median fire test, mesh de-dup and retry, the trust score, incident codes, responder-only resolution, the audit log, drills, the WEA template, the Time Machine, the offline model and the Gemini path with its fallback.

**15. Those boards are Bluetooth, not LoRa. Why should I count them?**
Because the radio is the one thing we swapped: the 24-byte packed message, the de-dup by message id, the hop count and TTL, and the gateway's serial output are the same code path the LoRa build uses. BLE reaches ten metres and LoRa reaches kilometres, which is why the production BOM has an SX1262 and why we say so on the hardware page.

**16. Does this replace the fire alarm?**
No, and the firmware header and README say so: it is a supplement to code-required detection, adding location, trend and networking that a panel's zone number cannot give. A production indoor node would also swap the MQ-2 for an electrochemical CO sensor and a proper photoelectric smoke chamber.

**17. What happens when the node in the fire burns?**
Its last readings and its priority alarm message are already on the neighbours' store-and-forward queues, and the neighbours keep reporting; the map shows the node going offline, which is itself information. A phone that was joined to it can walk to the next node and report again, and the responder sees both reports side by side.

**18. How long does a node run without power or sun?**
About three days in normal mode on the 3400 mAh cell, 12 to 18 hours in full disaster mode with the access point up and sensors continuous, and indefinitely in normal mode on the 2 W panel in a Seattle summer. Indoor nodes are mains-powered with the cell as backup.
