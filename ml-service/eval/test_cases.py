"""
Held-out test cases — different wording than the training templates in
data_gen.py, so accuracy here is the real generalization number, not the
inflated one from testing on templated text.

Severity rubric:
  critical - fails a hard/non-negotiable numeric or safety requirement
  major    - falls short of a requirement but isn't safety-critical
  minor    - cosmetic/administrative mismatch, no functional impact
  ok       - fully conforms
"""

TEST_CASES = [
    # --- critical ---
    {
        "text": "The vendor's battery bank only holds load for 7 minutes before the generator picks up, well under what the electrical spec calls for.",
        "expected": "critical"
    },
    {
        "text": "Shop drawings show a single UPS module with no backup — the project requires at least one spare unit per bank and this submittal has none.",
        "expected": "critical"
    },
    {
        "text": "This cooling package skips hot aisle containment entirely in a zone that's well over the density threshold requiring it.",
        "expected": "critical"
    },
    {
        "text": "Fire suppression submittal proposes a system rated for a smaller room volume than the actual white space being protected.",
        "expected": "critical"
    },
    # --- major ---
    {
        "text": "The battery vendor only guarantees 7 years of service life, a bit under the 10-year figure called out in the spec.",
        "expected": "major"
    },
    {
        "text": "Cooling unit efficiency comes in a couple points under the target the mechanical spec asks for, though still within typical industry range.",
        "expected": "major"
    },
    {
        "text": "Delivery lead time on the switchgear submittal is longer than what the schedule assumed, creating real but not yet critical pressure.",
        "expected": "major"
    },
    {
        "text": "Proposed generator set is rated close to but not quite at the standby capacity figure required in the spec.",
        "expected": "major"
    },
    # --- minor ---
    {
        "text": "Submittal cover sheet lists an older document revision number than what's currently in circulation, though the technical content matches.",
        "expected": "minor"
    },
    {
        "text": "Nameplate color called out in the submittal is a slightly different shade of grey than the appendix sample, purely cosmetic.",
        "expected": "minor"
    },
    {
        "text": "Vendor used a slightly different tag naming convention on the drawing than the project standard, easy fix before issue-for-construction.",
        "expected": "minor"
    },
    {
        "text": "Submittal package is missing a signature block on one transmittal form, otherwise complete and technically compliant.",
        "expected": "minor"
    },
    # --- ok ---
    {
        "text": "Everything in this switchgear submittal lines up with the one-line diagram and the spec requirements, no issues found on review.",
        "expected": "ok"
    },
    {
        "text": "Generator capacity, fuel autonomy, and emissions rating all match what was called for, submittal is good to approve.",
        "expected": "ok"
    },
    {
        "text": "Containment panel configuration matches the required zone density rules exactly, fully in line with spec.",
        "expected": "ok"
    },
    {
        "text": "Reviewed the fire alarm submittal against NFPA references in the spec — coverage, device spacing, and zoning all check out.",
        "expected": "ok"
    },
]
