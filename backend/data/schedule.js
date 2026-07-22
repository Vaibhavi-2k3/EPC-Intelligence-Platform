// Sample schedule + procurement snapshot for one project.
// Real version would sync from P6/MSP + the procurement/ERP system.

const TASKS = [
  {
    id: "TSK-014",
    name: "Electrical Room Ready for UPS Install",
    plannedFinish: "2026-08-10",
    criticalPath: true,
    floatDays: 0,
    notes: "Predecessor for TSK-015. Civil + containment work, on track per last site report."
  },
  {
    id: "TSK-015",
    name: "UPS Module Installation (Module A/B)",
    plannedStart: "2026-08-15",
    plannedFinish: "2026-08-29",
    criticalPath: true,
    floatDays: 0,
    dependsOn: "TSK-014",
    procurementRef: "PROC-UPS-14",
    crewDependency: 1,
    notes: "Feeds directly into integrated systems testing (TSK-021). No float on this task per baseline schedule."
  },
  {
    id: "TSK-018",
    name: "CRAH Unit Installation, Zone 3",
    plannedStart: "2026-08-20",
    plannedFinish: "2026-09-02",
    criticalPath: false,
    floatDays: 12,
    dependsOn: "TSK-014",
    procurementRef: "PROC-CRAH-09",
    crewDependency: 0,
    notes: "12 days of float against the critical path per baseline schedule."
  },
  {
    id: "TSK-021",
    name: "Integrated Systems Testing (Power Train)",
    plannedStart: "2026-09-01",
    plannedFinish: "2026-09-15",
    criticalPath: true,
    floatDays: 0,
    dependsOn: "TSK-015",
    notes: "Requires commissioning crew mobilised on-site; scheduled crew arrival 2026-08-28."
  }
];

const PROCUREMENT = [
  {
    id: "PROC-UPS-14",
    item: "2MW UPS Modules (Module A/B) — PowerGrid Systems Ltd",
    poIssueDate: "2026-05-02",
    quotedLeadTimeWeeks: 16,
    expectedDelivery: "2026-08-24",
    vendorOtdRate: 0.78,
    changeOrderCount: 1,
    status: "In production — vendor confirmed on schedule as of last status call (2026-07-10)",
    notes: "Quoted lead time of 16 weeks from PO date lands delivery AFTER the planned install start of 2026-08-15."
  },
  {
    id: "PROC-CRAH-09",
    item: "CRAH Units, Zone 3 — Thermatek Industrial",
    poIssueDate: "2026-04-20",
    quotedLeadTimeWeeks: 14,
    expectedDelivery: "2026-07-27",
    vendorOtdRate: 0.91,
    changeOrderCount: 0,
    status: "Shipped — in transit, on schedule",
    notes: "Comfortably ahead of the 2026-08-20 planned install start."
  }
];

const WORKFORCE_NOTES = `Commissioning crew (power train specialists) mobilisation confirmed for
2026-08-28, contracted through a third-party commissioning agency. This is a fixed
mobilisation date in their master schedule; rebooking inside a 3-week window has a
2-week minimum notice requirement per the agency contract.`;

function scheduleAsText() {
  const t = TASKS.map(
    (x) =>
      `[${x.id}] ${x.name} | Planned: ${x.plannedStart || "—"} to ${x.plannedFinish} | ` +
      `Critical path: ${x.criticalPath ? "YES" : "no"} | Depends on: ${x.dependsOn || "—"} | ` +
      `Procurement ref: ${x.procurementRef || "—"} | Notes: ${x.notes}`
  ).join("\n");

  const p = PROCUREMENT.map(
    (x) =>
      `[${x.id}] ${x.item} | PO issued: ${x.poIssueDate} | Quoted lead time: ${x.quotedLeadTimeWeeks} weeks | ` +
      `Expected delivery: ${x.expectedDelivery} | Status: ${x.status} | Notes: ${x.notes}`
  ).join("\n");

  return `SCHEDULE (critical path tasks):\n${t}\n\nPROCUREMENT TRACKER:\n${p}\n\nWORKFORCE / COMMISSIONING NOTES:\n${WORKFORCE_NOTES}`;
}

function daysBetween(dateA, dateB) {
  // dateA - dateB, in days
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

// Builds the feature vector the ML schedule-risk model expects, for every
// task that has a linked procurement item.
function getMLFeatureRows() {
  return TASKS
    .filter((t) => t.procurementRef)
    .map((t) => {
      const proc = PROCUREMENT.find((p) => p.id === t.procurementRef);
      if (!proc) return null;
      return {
        task_id: t.id,
        lead_time_weeks: proc.quotedLeadTimeWeeks,
        buffer_days: daysBetween(t.plannedStart, proc.expectedDelivery),
        task_float_days: t.floatDays ?? 0,
        vendor_otd_rate: proc.vendorOtdRate,
        crew_dependency: t.crewDependency ?? 0,
        change_order_count: proc.changeOrderCount ?? 0
      };
    })
    .filter(Boolean);
}

module.exports = { TASKS, PROCUREMENT, WORKFORCE_NOTES, scheduleAsText, getMLFeatureRows };
