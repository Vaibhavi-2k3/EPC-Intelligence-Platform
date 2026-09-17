const test = require("node:test");
const assert = require("node:assert/strict");

const { DOCUMENTS, corpusAsText, findById } = require("../data/documents");

test("DOCUMENTS contains the demo spec/RFI/submittal set", () => {
  assert.ok(DOCUMENTS.length >= 6);
  const ids = DOCUMENTS.map((d) => d.id);
  for (const expected of ["SPEC-ELEC-04", "SPEC-MECH-07", "RFI-0142", "SUB-UPS-14", "SUB-CRAH-09"]) {
    assert.ok(ids.includes(expected), `missing document ${expected}`);
  }
  assert.ok(DOCUMENTS.every((d) => d.id && d.title && d.text));
});

test("corpusAsText includes every doc id with a [DOC-ID] header", () => {
  const text = corpusAsText();
  for (const d of DOCUMENTS) {
    assert.ok(text.includes(`[${d.id}]`), `corpus missing header for ${d.id}`);
  }
});

test("findById returns the right document", () => {
  const doc = findById("SPEC-ELEC-04");
  assert.ok(doc);
  assert.match(doc.text, /12 minutes/);
  assert.equal(doc.type, "specification");
});

test("findById returns undefined for unknown ids", () => {
  assert.equal(findById("SUB-UNKNOWN"), undefined);
  assert.equal(findById(""), undefined);
  assert.equal(findById(null), undefined);
});