const test = require("node:test");
const assert = require("node:assert/strict");

const { TASKS, PROCUREMENT, scheduleAsText, getMLFeatureRows } = require("../data/schedule");

test("getMLFeatureRows only includes tasks with a linked procurement item", () => {
  const rows = getMLFeatureRows();
  assert.equal(rows.length, 2);
  const ids = rows.map((r) => r.task_id).sort();
  assert.deepEqual(ids, ["TSK-015", "TSK-018"]);
});

test("getMLFeatureRows computes buffer days as planned start minus expected delivery", () => {
  const ups = getMLFeatureRows().find((r) => r.task_id === "TSK-015");
  assert.ok(ups);
  // planned start 2026-08-15, expected delivery 2026-08-24 => -9 days
  assert.equal(ups.buffer_days, -9);
  assert.equal(ups.vendor_otd_rate, 0.78);
  assert.equal(ups.lead_time_weeks, 16);
  assert.equal(ups.change_order_count, 1);
  assert.equal(ups.crew_dependency, 1);
});

test("scheduleAsText is non-empty and mentions critical path + procurement refs", () => {
  const text = scheduleAsText();
  assert.ok(text.length > 100);
  assert.match(text, /TSK-014/);
  assert.match(text, /PROC-UPS-14/);
  assert.match(text, /commissioning/);
});

test("every procurement-linked task resolves to a real procurement record", () => {
  for (const row of getMLFeatureRows()) {
    const task = TASKS.find((t) => t.id === row.task_id);
    assert.ok(task, `task ${row.task_id} is not in TASKS`);
    const proc = PROCUREMENT.find((p) => p.id === task.procurementRef);
    assert.ok(proc, `procurement ref ${task.procurementRef} is not in PROCUREMENT`);
  }
});