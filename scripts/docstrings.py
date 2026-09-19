"""Lists top-level functions without a /** docstring */ in source files changed since main.

CodeRabbit blocks a PR below 80% docstring coverage on touched functions (.coderabbit.yaml);
this holds changed files to 100% so the check never fires. Usage: python3 scripts/docstrings.py [base]
"""
import re
import subprocess
import sys

base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
FUNC = re.compile(r"(export\s+)?(default\s+)?((async\s+)?function\s+\w+|const\s+\w+\s*=\s*(async\s*)?(<[^>]*>)?\([^)]*\)\s*(:\s*[^=]+)?=>)")
changed = subprocess.run(["git", "diff", "--name-only", "--diff-filter=d", base, "--", "src"], capture_output=True, text=True, check=True).stdout.split()
missing = []
for path in changed:
    if ".test." in path or not path.endswith((".ts", ".tsx")):
        continue
    lines = open(path).read().split("\n")
    for i, line in enumerate(lines):
        if not FUNC.match(line):  # match() anchors at column 0, so nested functions are skipped
            continue
        above = next((l.strip() for l in reversed(lines[:i]) if l.strip()), "")
        if not above.endswith("*/"):
            missing.append(f"{path}:{i + 1}: {line.strip()[:80]}")
print("\n".join(missing) or "Every top-level function in the changed files has a docstring.")
sys.exit(1 if missing else 0)
