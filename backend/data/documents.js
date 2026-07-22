// Demo doc set — a few specs, RFIs, and submittals for the sample project.
// Swap this for a real ingestion pipeline (OCR + vector store) later.

const DOCUMENTS = [
  {
    id: "SPEC-ELEC-04",
    title: "Electrical Systems Specification, Rev C — Sec 3",
    desc: "UPS topology, redundancy (N+1), runtime, and battery requirements.",
    type: "specification",
    text: `SPEC-ELEC-04, Section 3.2 (UPS Systems): The facility electrical architecture
shall provide UPS redundancy of N+1 per module, with a minimum autonomy (runtime) at
full rated load of 12 minutes prior to generator assumption of load. All UPS units
shall be double-conversion topology, minimum 97% efficiency at 40% load.
Section 3.4 (Battery Systems): Valve-regulated lead-acid (VRLA) batteries shall have
a design life of not less than 10 years at 25°C ambient, with monthly internal
resistance monitoring.`
  },
  {
    id: "SPEC-MECH-07",
    title: "Mechanical Cooling Specification, Rev B — Sec 5",
    desc: "CRAH unit redundancy, setpoints, and containment requirements.",
    type: "specification",
    text: `SPEC-MECH-07, Section 5.1 (Cooling Redundancy): Computer Room Air Handler
(CRAH) units shall be sized and deployed at N+2 redundancy per cooling zone. Supply
air temperature setpoint: 18°C ± 1°C.
Section 5.3 (Containment): Hot aisle containment is mandatory for all IT white space
exceeding 500kW zone density.`
  },
  {
    id: "RFI-0142",
    title: "RFI-0142 — UPS Runtime Clarification",
    desc: "Contractor query on battery autonomy vs. generator start time.",
    type: "rfi",
    text: `RFI-0142 (Submitted by Contractor, Status: Answered): Query — "Given
generator start and transfer sequence typically completes within 45 seconds, is the
12-minute UPS autonomy requirement in SPEC-ELEC-04 §3.2 intended as a hard minimum
even where dual utility feeds exist?"
Answer (Engineer of Record): "Yes, the 12-minute autonomy is a hard minimum
regardless of utility feed redundancy, to cover generator failure-to-start
contingency per Tier III concurrent maintainability requirements. No exception
granted."`
  },
  {
    id: "RFI-0158",
    title: "RFI-0158 — Containment Scope Boundary",
    desc: "Clarification on which IT zones require hot aisle containment.",
    type: "rfi",
    text: `RFI-0158 (Submitted by Contractor, Status: Answered): Query — "Does the
500kW zone density threshold in SPEC-MECH-07 §5.3 apply per-room or per-rack-row?"
Answer (Engineer of Record): "The threshold applies per contained zone (typically a
rack row group), not per room. Any zone exceeding 500kW must have hot aisle
containment regardless of overall room density."`
  },
  {
    id: "SUB-UPS-14",
    title: "Submittal SUB-UPS-14 — 2MW UPS Modules",
    desc: "Vendor shop drawing and datasheet for UPS system, Module A/B.",
    type: "submittal",
    text: `Submittal SUB-UPS-14 (Vendor: PowerGrid Systems Ltd): Proposed UPS units —
2MW modular double-conversion, rated efficiency 96.5% at 40% load. Configuration: N+1
per module bank. Battery autonomy at full rated load: 9 minutes (extended battery
cabinet optional, adds 4 minutes at additional cost, not included in base scope).
Battery type: VRLA, design life 8 years at 25°C. Submitted for approval, awaiting EOR
sign-off.`
  },
  {
    id: "SUB-CRAH-09",
    title: "Submittal SUB-CRAH-09 — CRAH Units, Zone 3",
    desc: "Vendor shop drawing and datasheet for cooling units, Zone 3.",
    type: "submittal",
    text: `Submittal SUB-CRAH-09 (Vendor: Thermatek Industrial): Proposed CRAH
configuration for Zone 3 (contained hot aisle, IT load 640kW): 6 units deployed, each
rated to cover N+1 zone requirement assuming 5 units required at design load. Supply
air setpoint configurable 16-22°C, factory default 20°C. Hot aisle containment panels
included in scope.`
  }
];

function corpusAsText() {
  return DOCUMENTS.map(d => `[${d.id}] ${d.title}\n${d.text}`).join("\n\n");
}

function findById(id) {
  return DOCUMENTS.find(d => d.id === id);
}

module.exports = { DOCUMENTS, corpusAsText, findById };
