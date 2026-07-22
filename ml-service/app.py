"""
ML microservice — serves the two trained scikit-learn models over HTTP.
The Node backend calls this service for quantitative risk scoring / text
classification, then passes the structured ML output to the LLM for
explanation and mitigation drafting. Run training scripts first:
    python train_schedule_model.py
    python train_compliance_model.py
Then start this service:
    uvicorn app:app --port 8000
"""

from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODELS_DIR = Path(__file__).parent / "models"

app = FastAPI(title="EPC Intelligence Platform — ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_schedule_bundle = None
_compliance_model = None


def _load_models():
    global _schedule_bundle, _compliance_model
    schedule_path = MODELS_DIR / "schedule_risk_model.joblib"
    compliance_path = MODELS_DIR / "compliance_severity_model.joblib"

    if schedule_path.exists():
        _schedule_bundle = joblib.load(schedule_path)
    if compliance_path.exists():
        _compliance_model = joblib.load(compliance_path)


_load_models()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "schedule_model_loaded": _schedule_bundle is not None,
        "compliance_model_loaded": _compliance_model is not None,
    }


# ---------------------------------------------------------------------------
# Schedule Delay Risk Classifier
# ---------------------------------------------------------------------------
class ScheduleRiskRequest(BaseModel):
    task_id: str
    lead_time_weeks: float = Field(..., description="Vendor quoted lead time in weeks")
    buffer_days: float = Field(..., description="planned_start - expected_delivery, in days")
    task_float_days: float = Field(..., ge=0)
    vendor_otd_rate: float = Field(..., ge=0, le=1, description="Vendor historical on-time-delivery rate")
    crew_dependency: Literal[0, 1] = Field(..., description="1 if a fixed downstream mobilisation depends on this task")
    change_order_count: int = Field(..., ge=0)


class ScheduleRiskResponse(BaseModel):
    task_id: str
    delay_probability: float
    risk_level: str
    feature_importances: dict


def _risk_level(p: float) -> str:
    if p >= 0.65:
        return "critical"
    if p >= 0.40:
        return "high"
    if p >= 0.20:
        return "medium"
    return "low"


@app.post("/ml/schedule-risk", response_model=ScheduleRiskResponse)
def schedule_risk(req: ScheduleRiskRequest):
    if _schedule_bundle is None:
        raise HTTPException(500, "Schedule risk model not trained. Run train_schedule_model.py first.")

    model = _schedule_bundle["model"]
    features = _schedule_bundle["features"]
    importances = _schedule_bundle.get("feature_importances", {})

    row = pd.DataFrame([{f: getattr(req, f) for f in features}])
    proba = float(model.predict_proba(row)[0][1])

    return ScheduleRiskResponse(
        task_id=req.task_id,
        delay_probability=round(proba, 4),
        risk_level=_risk_level(proba),
        feature_importances=importances,
    )


# ---------------------------------------------------------------------------
# Compliance Deviation Severity Classifier
# ---------------------------------------------------------------------------
class ComplianceSeverityRequest(BaseModel):
    text: str


class ComplianceSeverityResponse(BaseModel):
    predicted_severity: str
    confidence: float
    class_probabilities: dict


@app.post("/ml/compliance-severity", response_model=ComplianceSeverityResponse)
def compliance_severity(req: ComplianceSeverityRequest):
    if _compliance_model is None:
        raise HTTPException(500, "Compliance model not trained. Run train_compliance_model.py first.")

    if not req.text or not req.text.strip():
        raise HTTPException(400, "Field 'text' is required.")

    proba = _compliance_model.predict_proba([req.text])[0]
    classes = _compliance_model.classes_
    probs = dict(zip(classes, [round(float(p), 4) for p in proba]))
    best_idx = proba.argmax()

    return ComplianceSeverityResponse(
        predicted_severity=str(classes[best_idx]),
        confidence=round(float(proba[best_idx]), 4),
        class_probabilities=probs,
    )
