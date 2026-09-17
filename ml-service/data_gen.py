"""
Synthetic training data. Swap for real ERP/P6/QMS exports when you have them.
"""

import numpy as np
import pandas as pd


def generate_schedule_training_data(n=1500, seed=42):
    """
    Each row = one procurement-linked task in a past EPC project.
    Label `delayed` = 1 if the task finished later than its planned finish date.

    Features:
      lead_time_weeks      quoted vendor lead time
      buffer_days          (planned_start - expected_delivery), negative = late delivery
      task_float_days      schedule float/slack on this task (0 = critical path)
      vendor_otd_rate      vendor's historical on-time-delivery rate (0-1)
      crew_dependency      1 if a fixed-date downstream mobilisation depends on this task
      change_order_count   number of change orders logged against this task/vendor
    """
    rng = np.random.default_rng(seed)

    lead_time_weeks = rng.uniform(4, 24, n)
    buffer_days = rng.normal(10, 18, n)  # can be negative (late) or positive (early)
    task_float_days = rng.exponential(6, n).round().clip(0, 40)
    vendor_otd_rate = rng.beta(6, 2, n)  # skewed toward reliable vendors, some bad ones
    crew_dependency = rng.integers(0, 2, n)
    change_order_count = rng.poisson(0.6, n)

    # Underlying "true" risk signal (logistic combination) + noise.
    z = (
        -0.09 * buffer_days
        - 3.2 * (vendor_otd_rate - 0.5)
        - 0.08 * task_float_days
        + 0.55 * crew_dependency
        + 0.35 * change_order_count
        + 0.04 * lead_time_weeks
        - 0.6
    )
    prob_delay = 1 / (1 + np.exp(-z))
    delayed = rng.binomial(1, prob_delay)

    df = pd.DataFrame({
        "lead_time_weeks": lead_time_weeks,
        "buffer_days": buffer_days,
        "task_float_days": task_float_days,
        "vendor_otd_rate": vendor_otd_rate,
        "crew_dependency": crew_dependency,
        "change_order_count": change_order_count,
        "delayed": delayed,
    })
    return df


# Severity vocabulary used to synthesize labeled deviation-description text.
# Each template is tagged with how the two numbers relate semantically:
#   a_lt_b  -> a falls short of the required b  (a < b)
#   a_gt_b  -> a exceeds what b assumed          (a > b)
#   any     -> no ordering implied (a, b arbitrary)
_CRITICAL_TEMPLATES = [
    ("a_lt_b", "submittal offers {a} minutes runtime versus a {b} minute hard minimum required by spec"),
    ("a_lt_b", "proposed unit falls short of the mandatory {b} redundancy level required by spec, offering only {a}"),
    ("a_lt_b", "vendor datasheet shows {a} rating which fails the non-negotiable {b} threshold in the specification"),
    ("a_lt_b", "design life of {a} years is below the required minimum of {b} years with no exception on record"),
    ("a_lt_b", "cooling capacity of {a} kW is far below the {b} kW the zone heat load demands at full IT load"),
    ("a_lt_b", "fire suppression system is sized for {a} cubic feet but the protected space requires {b}: under-capacity with no waiver"),
    ("a_lt_b", "uplink capacity of {a} Gbps fails the mandatory {b} Gbps minimum for this service tier"),
    ("a_lt_b", "battery bank only sustains load for {a} minutes before generator pick-up, well under the {b} minute minimum the specification requires"),
]
_MAJOR_TEMPLATES = [
    ("a_lt_b", "battery design life stated as {a} years versus {b} year minimum in the specification"),
    ("a_lt_b", "efficiency rating of {a}% is marginally below the {b}% target stated in spec"),
    ("a_gt_b", "submittal lead time of {a} weeks creates schedule pressure against the {b} week buffer assumed in spec"),
    ("any", "vendor proposes {a} configuration which partially deviates from the {b} configuration required"),
    ("a_lt_b", "switchgear bus rating of {a} kA is a bit under the {b} kA short-circuit rating required, fixable with a small upgrade"),
    ("a_lt_b", "standby generator rated {a} kVA versus the {b} kVA required — close to spec but still short"),
]
_MINOR_TEMPLATES = [
    ("any", "minor labeling inconsistency between submittal drawing and spec nomenclature for {a} versus {b}"),
    ("any", "submittal references an older revision ({a}) than the current spec revision ({b}), content otherwise aligned"),
    ("any", "cosmetic finish specified as {a} differs slightly from the {b} finish noted in spec appendix"),
    ("any", "submittal dimension on the layout differs by a few millimetres from the {a} mm nominal ({b} mm shown), no functional impact"),
    ("any", "drawing title block references {a} while the current document set is revision {b}, content identical"),
    ("any", "tag on the transmittal form is {a} where the project standard says {b}, easily corrected before issue"),
]
_OK_TEMPLATES = [
    ("any", "configuration of {a} matches the {b} requirement specified exactly, fully conforms"),
    ("any", "redundancy level {a} meets or exceeds the {b} minimum required by spec"),
    ("any", "vendor submittal for {a} is fully compliant with {b} clause, no deviations found"),
    ("any", "all specified parameters including the {a} and {b} items are confirmed as provided, submittal recommended for approval"),
    ("any", "vendor confirmed compliance with every clause in the spec; {a} and {b} configurations accepted as-is"),
    ("any", "proposed {a} matches the required {b} exactly, no deviations, signed and sealed as submitted"),
    ("any", "capacity, autonomy, and emissions rating all line up with what the specification calls for; submittal ready for approval"),
]

# Precedence tiers a number sits in, so pairs read sensibly (e.g. a "7 minute"
# runtime vs a "12 minute" minimum, never the reverse).
_LOW_TO_HIGH = [1, 2, 3, 5, 7, 9, 12, 16, 20, 30, 45, 60]


def _draw_pair(rng, kind):
    if kind == "a_lt_b":
        a = int(rng.choice(_LOW_TO_HIGH[:-2]))
        b = int(rng.choice(_LOW_TO_HIGH[_LOW_TO_HIGH.index(a) + 1 :]))
        return a, b
    if kind == "a_gt_b":
        b = int(rng.choice(_LOW_TO_HIGH[:-2]))
        a = int(rng.choice(_LOW_TO_HIGH[_LOW_TO_HIGH.index(b) + 1 :]))
        return a, b
    a, b = rng.integers(1, 20, 2)
    return int(a), int(b)


def generate_compliance_training_data(n_per_class=180, seed=7):
    rng = np.random.default_rng(seed)

    def fill(templates, count):
        rows = []
        for _ in range(count):
            kind, t = templates[rng.integers(0, len(templates))]
            a, b = _draw_pair(rng, kind)
            rows.append(t.format(a=a, b=b))
        return rows

    critical = fill(_CRITICAL_TEMPLATES, n_per_class)
    major = fill(_MAJOR_TEMPLATES, n_per_class)
    minor = fill(_MINOR_TEMPLATES, n_per_class)
    ok = fill(_OK_TEMPLATES, n_per_class)

    texts = critical + major + minor + ok
    labels = (
        ["critical"] * len(critical)
        + ["major"] * len(major)
        + ["minor"] * len(minor)
        + ["ok"] * len(ok)
    )
    df = pd.DataFrame({"text": texts, "severity": labels})
    return df.sample(frac=1, random_state=seed).reset_index(drop=True)
