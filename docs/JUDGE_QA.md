# Judge Q&A

Fifteen questions we expect, each with a two-sentence answer. Say the answer, then stop; let the judge ask the follow-up.

**1. Isn't this Dryad Silvanet?**
Dryad proves that cheap gas-sensor meshes find fires early, and they put an ML model in each sensor because a forest has no false alarms from the sky. We put the intelligence between the sensors, comparing each node against its neighbours' median, because in a schoolyard or a warehouse the sky itself is the false alarm, and we add inbound verified reports, roles and daily use that Dryad does not have.

**2. Isn't the mesh just Meshtastic?**
Yes, the radio layer is the same design family: LoRa flooding with de-duplication, TTL and store-and-forward, and we would happily build on their firmware. Meshtastic carries whatever anyone sends and is spoofable by design; Sentinel adds the sensor baseline, the trust score and a responder console on top, which is where the product lives.

**3. Can you really text every phone in the area?**
No, and we say so on screen: alerting every phone is Wireless Emergency Alerts through FEMA's IPAWS, which only authorised agencies can issue. Sentinel sends to an opt-in registry per zone, pushes the alert to every phone joined to a node, and drafts the CAP-shaped WEA message so the agency's text is already written when they log in.

**4. Cheap PM sensors drift. How do you trust them?**
They do, and the PMS5003 also needs cleaning; we do not pretend otherwise. Because every decision is a comparison against neighbours, a drifting node shows up as an outlier without heat or gas, which the dashboard flags for cleaning rather than calling a fire.

**5. Student rosters and parent phone numbers: FERPA, TCPA?**
Both apply and neither is built today: the SMS registry needs TCPA-compliant opt-in and STOP handling, and roster data needs a data processing agreement with the district under FERPA. The architecture keeps roster data on the school's edge server and sends only class counts and missing-student references upward, which is the shape those agreements want.

**6. How far does this scale?**
A flooding mesh holds about 50 to 80 nodes per LoRa channel at five-minute telemetry before airtime collisions climb, so a large site splits by channel or adds gateways, each anchoring its own segment. The backend is stateless FastAPI with tenant-partitioned Postgres and Redis fan-out; the demo swaps Postgres for SQLite and the rest of the code path is the same.

**7. Why no machine learning?**
The rules fit on a slide, a principal can read them, and an after-action review can replay exactly why the engine said fire. We would add a model only where a rule fails with data in hand, and even then the rule would stay as the explanation the responder sees.

**8. Why $31? What is in that number?**
That is the BOM at 1,000 units including $2.50 of assembly and test: ESP32-S3, SX1262 LoRa, PMS5003, BME280, MQ-2, an 18650 cell, charger and boost, a 2 W panel, PCB, enclosure. At quantity one it is about $60, and the indoor mains-powered variant drops about $6 by losing the panel and the duty-cycling hardware.

**9. Why schools first and not warehouses, where the money is?**
Schools are the distribution story: Washington requires a drill every month, smoke season forces a daily outdoor decision, and the buyer is a CTIO who already runs the building's WiFi. Warehouses are the revenue story, at $25 per node per year plus a responder integration fee, and one prevented pallet fire pays for the building.

**10. What stops someone from spamming "trapped"?**
Nothing stops them from pressing the button, but the score tells the responder what to trust: proximity to a node, sensor corroboration, a second device, a verified role, GPS consistency and device history all add or subtract. Three confirmed false reports block the device, and internet-only reports with no node stamp never rise above Likely.

**11. How does a phone reach the node with no internet?**
The ESP32 runs its own access point, like a phone hotspot, and a tiny DNS server on it answers every hostname with the node's own address, so the phone opens the sign-in page automatically the way hotel WiFi does. Today's demo stands in for that with the laptop's hotspot, and the page says so.

**12. What is real in this demo and what is simulated?**
Simulated and labelled on screen: the sensors, the LoRa radio (local UDP with 15% drop), the SMS provider and the node's captive portal. Real: the alert engine and thresholds, the neighbour-median fire test, mesh de-dup and retry, the trust score, incident codes, responder-only resolution, the audit log, drills, the WEA template and the Time Machine.

**13. Does this replace the fire alarm?**
No, and the firmware header and README say so: it is a supplement to code-required detection, adding location, trend and networking that a panel's zone number cannot give. A production indoor node would also swap the MQ-2 for an electrochemical CO sensor and a proper photoelectric smoke chamber.

**14. What happens when the node in the fire burns?**
Its last readings and its priority alarm message are already on the neighbours' store-and-forward queues, and the neighbours keep reporting; the map shows the node going offline, which is itself information. A phone that was joined to it can walk to the next node and report again, and the responder sees both reports side by side.

**15. How long does a node run without power or sun?**
About three days in normal mode on the 3400 mAh cell, 12 to 18 hours in full disaster mode with the access point up and sensors continuous, and indefinitely in normal mode on the 2 W panel in a Seattle summer. Indoor nodes are mains-powered with the cell as backup.
