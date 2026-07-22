(function () {
  const API_BASE = ""; // same-origin; change if frontend is hosted separately from backend

  let DOCS = [];

  async function loadDocuments() {
    try {
      const res = await fetch(`${API_BASE}/api/documents`);
      const data = await res.json();
      DOCS = data.documents || [];
      renderDocList();
      renderSubmittalOptions();
      document.getElementById("epcDocCount").textContent = DOCS.length;
    } catch (err) {
      document.getElementById("epcDocList").innerHTML =
        `<div class="epc-empty">Could not load documents: ${err.message}. Is the backend running?</div>`;
    }
  }

  function renderDocList() {
    const docListEl = document.getElementById("epcDocList");
    docListEl.innerHTML = "";
    DOCS.forEach((d) => {
      const div = document.createElement("div");
      div.className = "epc-doc";
      div.innerHTML = `<span class="tag">${d.id}</span><div class="title">${d.title}</div><div class="desc">${d.desc}</div>`;
      docListEl.appendChild(div);
    });
  }

  function renderSubmittalOptions() {
    const subSelect = document.getElementById("epcSubmittalSelect");
    subSelect.innerHTML = "";
    DOCS.filter((d) => d.type === "submittal").forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.id} — ${d.title}`;
      subSelect.appendChild(opt);
    });
  }

  // ---- Tabs ----
  const panels = {
    rag: document.getElementById("epcPanelRag"),
    compliance: document.getElementById("epcPanelCompliance"),
    schedule: document.getElementById("epcPanelSchedule")
  };
  document.querySelectorAll(".epc-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".epc-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      Object.entries(panels).forEach(([key, el]) => {
        el.style.display = key === tab.dataset.tab ? "" : "none";
      });
    });
  });

  // ---- Knowledge Copilot ----
  const askBtn = document.getElementById("epcAskBtn");
  askBtn.addEventListener("click", async () => {
    const q = document.getElementById("epcQuestion").value.trim();
    const resultEl = document.getElementById("epcRagResult");
    if (!q) {
      resultEl.innerHTML = '<div class="epc-empty">Enter a question about the project documents above.</div>';
      return;
    }
    askBtn.disabled = true;
    resultEl.innerHTML = '<div class="epc-loading">Retrieving relevant clauses and drafting answer</div>';
    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Request failed");
      const withCites = data.answer.replace(/\[([A-Z0-9\-]+)\]/g, '<span class="epc-cite">$1</span>');
      resultEl.innerHTML = `<div class="epc-answer">${withCites}</div>`;
    } catch (err) {
      resultEl.innerHTML = `<div class="epc-empty">Query failed: ${err.message}</div>`;
    } finally {
      askBtn.disabled = false;
    }
  });

  // ---- Compliance Check ----
  const checkBtn = document.getElementById("epcCheckBtn");
  const resetBtn = document.getElementById("epcResetBtn");

  checkBtn.addEventListener("click", async () => {
    const submittalId = document.getElementById("epcSubmittalSelect").value;
    const resultEl = document.getElementById("epcComplianceResult");
    checkBtn.disabled = true;
    resultEl.innerHTML = '<div class="epc-loading">Comparing submittal against governing specification and RFIs</div>';
    try {
      const res = await fetch(`${API_BASE}/api/compliance/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittalId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Request failed");
      renderCompliance(data);
      checkBtn.style.display = "none";
      resetBtn.style.display = "";
    } catch (err) {
      resultEl.innerHTML = `<div class="epc-empty">Compliance check failed: ${err.message}</div>`;
    } finally {
      checkBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", () => {
    document.getElementById("epcComplianceResult").innerHTML = "";
    checkBtn.style.display = "";
    resetBtn.style.display = "none";
  });

  function renderCompliance(parsed) {
    const resultEl = document.getElementById("epcComplianceResult");
    const score = Math.max(0, Math.min(100, parsed.overall_score ?? 50));
    let html = `<div class="epc-scorebar">
      <span>COMPLIANCE SCORE</span>
      <div class="track"><div class="fill" style="width:${score}%"></div></div>
      <span>${score}/100</span>
    </div>`;
    (parsed.findings || []).forEach((f) => {
      const sev = (f.severity || "minor").toLowerCase();
      const mlSev = (f.ml_severity || "").toLowerCase();
      const agrees = mlSev && mlSev === sev;
      const mlBadge = f.ml_severity
        ? `<div class="epc-ml-tag ${agrees ? "agree" : "disagree"}">
             ML CLASSIFIER: ${f.ml_severity.toUpperCase()} (${Math.round((f.ml_confidence || 0) * 100)}% conf.)
             ${agrees ? "· agrees with LLM" : "· differs from LLM — review"}
           </div>`
        : "";
      html += `<div class="epc-finding">
        <span class="epc-sev ${sev}">${sev}</span>
        <div class="epc-finding-body">
          <div class="ftitle">${f.title || ""}</div>
          <div class="fdesc">${(f.detail || "").replace(/\b([A-Z]+-[A-Z0-9\-]+)\b/g, '<span class="epc-cite">$1</span>')}</div>
          ${mlBadge}
        </div>
      </div>`;
    });
    resultEl.innerHTML = html;
  }

  // ---- Schedule Risk Engine ----
  const scheduleBtn = document.getElementById("epcScheduleBtn");
  scheduleBtn.addEventListener("click", async () => {
    const resultEl = document.getElementById("epcScheduleResult");
    scheduleBtn.disabled = true;
    resultEl.innerHTML = '<div class="epc-loading">Cross-referencing schedule, procurement, and workforce constraints</div>';
    try {
      const res = await fetch(`${API_BASE}/api/schedule/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Request failed");
      renderScheduleRisks(data);
    } catch (err) {
      resultEl.innerHTML = `<div class="epc-empty">Schedule risk scan failed: ${err.message}</div>`;
    } finally {
      scheduleBtn.disabled = false;
    }
  });

  function renderScheduleRisks(parsed) {
    const resultEl = document.getElementById("epcScheduleResult");
    const risks = parsed.risks || [];
    if (!risks.length) {
      resultEl.innerHTML = '<div class="epc-empty">No risks returned.</div>';
      return;
    }
    let html = "";
    risks.forEach((r) => {
      const sev = (r.severity || "medium").toLowerCase();
      const sevClass = sev === "high" ? "major" : sev === "low" ? "minor" : sev;
      const mitigations = (r.mitigations || [])
        .map((m) => `<li>${m}</li>`)
        .join("");
      const probPct = typeof r.delay_probability === "number"
        ? `${Math.round(r.delay_probability * 100)}%`
        : null;
      html += `<div class="epc-finding">
        <span class="epc-sev ${sevClass}">${sev}</span>
        <div class="epc-finding-body">
          <div class="ftitle">${r.title || ""} <span class="epc-cite" style="margin-left:6px;">${r.lead_time_days ?? "?"} days lead</span></div>
          ${probPct ? `<div class="epc-ml-tag agree">ML MODEL: ${probPct} predicted delay probability (monotonic gradient boosting)</div>` : ""}
          <div class="fdesc">${(r.detail || "").replace(/\b([A-Z]+-[A-Z0-9\-]+)\b/g, '<span class="epc-cite">$1</span>')}</div>
          ${mitigations ? `<ul class="epc-mitigations">${mitigations}</ul>` : ""}
        </div>
      </div>`;
    });
    resultEl.innerHTML = html;
  }

  loadDocuments();

  // ---- What-If Simulator ----
  const bufferSlider = document.getElementById("epcBufferSlider");
  const otdSlider = document.getElementById("epcOtdSlider");
  const floatSlider = document.getElementById("epcFloatSlider");
  const coSlider = document.getElementById("epcCoSlider");
  const crewToggle = document.getElementById("epcCrewToggle");

  const bufferVal = document.getElementById("epcBufferVal");
  const otdVal = document.getElementById("epcOtdVal");
  const floatVal = document.getElementById("epcFloatVal");
  const coVal = document.getElementById("epcCoVal");

  const whatifFill = document.getElementById("epcWhatifFill");
  const whatifPct = document.getElementById("epcWhatifPct");
  const whatifLevel = document.getElementById("epcWhatifLevel");

  let whatifDebounce = null;

  function scoreWhatIf() {
    bufferVal.textContent = bufferSlider.value;
    otdVal.textContent = otdSlider.value;
    floatVal.textContent = floatSlider.value;
    coVal.textContent = coSlider.value;

    clearTimeout(whatifDebounce);
    whatifDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/schedule/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_time_weeks: 16,
            buffer_days: Number(bufferSlider.value),
            task_float_days: Number(floatSlider.value),
            vendor_otd_rate: Number(otdSlider.value),
            crew_dependency: crewToggle.checked ? 1 : 0,
            change_order_count: Number(coSlider.value)
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || "Scoring failed");
        const pct = Math.round(data.delay_probability * 100);
        whatifFill.style.width = `${pct}%`;
        whatifPct.textContent = `${pct}%`;
        whatifLevel.innerHTML = `Risk level: <span class="epc-cite">${data.risk_level.toUpperCase()}</span> — monotonic-constrained gradient boosting model, live scored`;
      } catch (err) {
        whatifLevel.textContent = `Scoring failed: ${err.message}`;
      }
    }, 200);
  }

  [bufferSlider, otdSlider, floatSlider, coSlider].forEach((el) =>
    el.addEventListener("input", scoreWhatIf)
  );
  crewToggle.addEventListener("change", scoreWhatIf);

  // Score once on load so the bar isn't empty when the tab is first opened.
  scoreWhatIf();
})();
