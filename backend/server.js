require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { getCompletion } = require("./llmClient");
const { DOCUMENTS, corpusAsText, findById } = require("./data/documents");
const { scheduleAsText, getMLFeatureRows } = require("./data/schedule");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const PORT = process.env.PORT || 3000;

async function callMLService(route, body) {
  const res = await fetch(`${ML_SERVICE_URL}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ML service ${route} returned ${res.status}: ${errText}`);
  }
  return res.json();
}

const KEY_ENV_VAR = {
  openai: "OPENAI_API_KEY",
  huggingface: "HF_TOKEN",
  gemini: "GEMINI_API_KEY",
  ollama: null, // no key needed — runs locally
  anthropic: "ANTHROPIC_API_KEY"
};
const provider = process.env.LLM_PROVIDER || "anthropic";
const keyVar = KEY_ENV_VAR[provider];
const hasKey = keyVar === null ? true : Boolean(process.env[keyVar]);

if (!hasKey) {
  console.warn(`[warn] no LLM API key set in .env for provider "${provider}" — /api/ask and friends will fail until you add one.`);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/documents", (req, res) => {
  const meta = DOCUMENTS.map(({ id, title, desc, type }) => ({ id, title, desc, type }));
  res.json({ documents: meta });
});

// Knowledge Copilot — question over the doc corpus, answers come back with [DOC-ID] citations
app.post("/api/ask", async (req, res) => {
  const question = (req.body?.question || "").trim();
  if (!question) {
    return res.status(400).json({ error: "Field 'question' is required." });
  }

  const system = `You are a project knowledge copilot for a data centre EPC
construction project. Answer ONLY using the provided document corpus. Every
factual claim must end with a bracketed citation to the source document ID, e.g.
[SPEC-ELEC-04]. If the corpus does not contain the answer, say so plainly. Be
concise (3-6 sentences). If relevant RFIs override or clarify a spec, mention that
explicitly.`;

  const user = `DOCUMENT CORPUS:\n${corpusAsText()}\n\nQUESTION: ${question}`;

  try {
    const answer = await getCompletion(system, user, 700);
    res.json({ answer });
  } catch (err) {
    console.error("ask failed:", err);
    res.status(502).json({ error: "Failed to reach the model.", detail: err.message });
  }
});

// Compliance check — LLM finds deviations, ML classifier cross-checks severity independently
app.post("/api/compliance/check", async (req, res) => {
  const submittalId = (req.body?.submittalId || "").trim();
  const submittal = findById(submittalId);

  if (!submittal) {
    return res.status(404).json({ error: `Unknown submittal id: ${submittalId}` });
  }

  const system = `You are a specification compliance agent for data centre EPC
construction. Compare the vendor submittal against the governing specifications
and any relevant RFIs in the corpus. Return STRICT JSON only, no markdown fences,
no preamble, in this exact shape:
{"overall_score": <0-100 integer, 100=fully compliant>,
 "findings": [{"severity": "critical|major|minor|ok", "title": "short finding title",
 "detail": "1-2 sentence explanation referencing clause numbers and doc IDs"}]}
Include at least one 'ok' finding for anything that fully conforms. Be specific and
cite doc IDs like SPEC-ELEC-04 or RFI-0142 inside the detail text.`;

  const user = `DOCUMENT CORPUS:\n${corpusAsText()}\n\nSUBMITTAL UNDER REVIEW: ${submittal.id}\n${submittal.text}\n\nEvaluate this submittal for spec compliance.`;

  try {
    const raw = await getCompletion(system, user, 900, true);
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (Array.isArray(parsed.findings)) {
      parsed.findings = await Promise.all(
        parsed.findings.map(async (f) => {
          try {
            const mlResult = await callMLService("/ml/compliance-severity", {
              text: f.detail || f.title || ""
            });
            return { ...f, ml_severity: mlResult.predicted_severity, ml_confidence: mlResult.confidence };
          } catch (mlErr) {
            console.warn("compliance classifier unreachable:", mlErr.message);
            return { ...f, ml_severity: null, ml_confidence: null };
          }
        })
      );
    }

    res.json(parsed);
  } catch (err) {
    console.error("compliance check failed:", err);
    res.status(502).json({ error: "Compliance check failed.", detail: err.message });
  }
});

// Schedule risk — ML model scores delay probability, LLM explains + suggests mitigations on top of it
app.post("/api/schedule/analyze", async (req, res) => {
  const featureRows = getMLFeatureRows();
  let mlResults = [];
  try {
    mlResults = await Promise.all(featureRows.map((row) => callMLService("/ml/schedule-risk", row)));
  } catch (mlErr) {
    console.error("schedule risk ML call failed:", mlErr.message);
    return res.status(502).json({ error: "ML schedule risk service unavailable.", detail: mlErr.message });
  }

  const mlSummary = mlResults
    .map(
      (r) =>
        `[${r.task_id}] ML model delay probability: ${(r.delay_probability * 100).toFixed(1)}% ` +
        `(risk level: ${r.risk_level}). Top drivers: ${Object.entries(r.feature_importances)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([k, v]) => `${k} (${v})`)
          .join(", ")}`
    )
    .join("\n");

  const system = `You are a predictive schedule risk agent for a data centre EPC
construction project. You are given: (a) trained ML model risk scores per task —
treat these delay probabilities and risk levels as ground truth, do not override
them — and (b) the underlying schedule, procurement, and workforce context.
Your job is to explain WHY each ML-flagged risk exists in plain language citing
specific dates and task/procurement IDs, and to propose concrete, specific
mitigation options (not generic advice like "expedite shipping" alone). Return
STRICT JSON only, no markdown fences, no preamble, in this exact shape:
{"risks": [{"severity": "critical|high|medium|low" (use the ML risk_level given, mapped 1:1),
  "task_id": "TSK-XXX",
  "title": "short risk title",
  "delay_probability": <the ML delay_probability for this task, as given>,
  "lead_time_days": <integer, days until this becomes unavoidable/critical, your estimate from context>,
  "detail": "1-3 sentence explanation referencing specific dates and task/procurement IDs",
  "mitigations": ["specific mitigation option 1", "specific mitigation option 2"]}]}
Include every task_id given in the ML scores, ordered by risk level (critical/high first).`;

  const user = `ML MODEL RISK SCORES (ground truth, do not change these):\n${mlSummary}\n\nPROJECT SCHEDULE AND PROCUREMENT SNAPSHOT:\n${scheduleAsText()}\n\nExplain each ML-flagged risk and propose mitigations.`;

  try {
    const raw = await getCompletion(system, user, 1200, true);
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.json({ ...parsed, ml_scores: mlResults });
  } catch (err) {
    console.error("schedule analysis failed:", err);
    res.status(502).json({ error: "Schedule risk analysis failed.", detail: err.message });
  }
});

// Fast path for the what-if slider — ML only, no LLM round trip
app.post("/api/schedule/score", async (req, res) => {
  try {
    const result = await callMLService("/ml/schedule-risk", { task_id: "WHATIF", ...req.body });
    res.json(result);
  } catch (err) {
    console.error("what-if scoring failed:", err);
    res.status(502).json({ error: "ML scoring failed.", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`EPC Intelligence Platform backend running at http://localhost:${PORT}`);
});
