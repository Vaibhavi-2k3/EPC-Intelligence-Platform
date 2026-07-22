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
_CRITICAL_TEMPLATES = [
    "submittal offers {a} minutes runtime versus a {b} minute hard minimum required by spec",
    "proposed unit falls short of the mandatory {b} redundancy level required by spec, offering only {a}",
    "vendor datasheet shows {a} rating which fails the non-negotiable {b} threshold in the specification",
    "design life of {a} years is below the required minimum of {b} years with no exception on record",
]
_MAJOR_TEMPLATES = [
    "battery design life stated as {a} years versus {b} year minimum in the specification",
    "efficiency rating of {a}% is marginally below the {b}% target stated in spec",
    "submittal lead time of {a} weeks creates schedule pressure against the {b} week buffer assumed in spec",
    "vendor proposes {a} configuration which partially deviates from the {b} configuration required",
]
_MINOR_TEMPLATES = [
    "minor labeling inconsistency between submittal drawing and spec nomenclature for {a} versus {b}",
    "submittal references an older revision ({a}) than the current spec revision ({b}), content otherwise aligned",
    "cosmetic finish specified as {a} differs slightly from the {b} finish noted in spec appendix",
]
_OK_TEMPLATES = [
    "configuration of {a} matches the {b} requirement specified exactly, fully conforms",
    "redundancy level {a} meets or exceeds the {b} minimum required by spec",
    "vendor submittal for {a} is fully compliant with {b} clause, no deviations found",
]


def generate_compliance_training_data(n_per_class=180, seed=7):
    rng = np.random.default_rng(seed)

    def fill(templates, count):
        rows = []
        for _ in range(count):
            t = templates[rng.integers(0, len(templates))]
            a = rng.integers(1, 20)
            b = rng.integers(1, 20)
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
