"""Lists top-level functions without a /** docstring */ in source files changed since main.

CodeRabbit blocks a PR below 80% docstring coverage on touched functions (.coderabbit.yaml);
this holds changed files to 100% so the check never fires. Usage: python3 scripts/docstrings.py [base]
"""
import re
import subprocess
import sys

# Matches only the head of a declaration at column 0, so a parameter list or return type that
# spans lines cannot hide a function. ponytail: a regex, not a parser (TypeScript 7 ships no
# parser API); it errs toward false positives, e.g. `const x = (a + b) * 2`. Swap in a parser
# if those ever get annoying.
FUNC = re.compile(r"(export\s+)?(default\s+)?(async\s+)?(function\b|const\s+\w+(\s*:[^=]+)?\s*=\s*(async\s+)?(function\b|<|\(|\w+\s*=>))")


def undocumented(text):
    """Returns (line number, line) for each top-level function not directly under a /** block."""
    lines = text.split("\n")
    found = []
    for i, line in enumerate(lines):
        if not FUNC.match(line):
            continue
        j = i - 1
        while j >= 0 and not lines[j].strip():
            j -= 1
        documented = j >= 0 and lines[j].rstrip().endswith("*/")
        while documented and "/*" not in lines[j]:
            j -= 1
        if not (documented and lines[j].lstrip().startswith("/**")):
            found.append((i + 1, line.strip()))
    return found


def self_check():
    """Fails loudly if the matcher stops seeing a declaration shape this repo uses."""
    missed = "\n".join([
        "export const a = (",
        "  x: number,",
        "): number => x;",
        "/* not a docstring */",
        "export function b() {}",
        "// line comment",
        "const c = async <T>(x: T) => x;",
        "export default function d() {}",
        "const e = (f: () => void): (() => void) => f;",
        "const g = x => x;",
    ])
    assert [n for n, _ in undocumented(missed)] == [1, 5, 7, 8, 9, 10], undocumented(missed)
    fine = "\n".join(["/** One line. */", "export const a = () => 1;", "/**", " * Block.", " */", "", "function b() {}", "const N = 5;", "  const nested = () => 1;"])
    assert undocumented(fine) == [], undocumented(fine)


if __name__ == "__main__":
    self_check()
    base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    changed = subprocess.run(["git", "diff", "--name-only", "--diff-filter=d", base, "--", "src"], capture_output=True, text=True, check=True).stdout.split()
    missing = [
        f"{path}:{n}: {line[:80]}"
        for path in changed
        if path.endswith((".ts", ".tsx")) and ".test." not in path
        for n, line in undocumented(open(path).read())
    ]
    print("\n".join(missing) or "Every top-level function in the changed files has a docstring.")
    sys.exit(1 if missing else 0)
