#!/usr/bin/env python3
"""Check that the Xcode project file is sane and complete.

Three failures this catches, all of which have actually happened here:

  1. **Conflict markers committed.** Merging two branches that each added
     Swift files conflicts in `project.pbxproj`. A `git add -A` sweeps the
     markers in, Xcode then reports only "Unable to read project", and the
     app cannot be built at all until someone finds them.

  2. **Duplicate ids.** `add-sources.py` derives its ids from the file path,
     so registering the same file twice produces two entries carrying the
     same id. A union merge of two branches that both added a file does the
     same thing. Xcode's behaviour is undefined and unhelpful.

  3. **A source file that exists but is never compiled.** The quiet one. The
     file is on disk, the editor shows it, `git` tracks it, and nothing in
     it runs — because it was never added to the Sources build phase. The
     symptom is a feature that simply does not appear, with no error.

Run before committing anything that touched the project file.
"""

from __future__ import annotations

import plistlib
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
PROJECT = HERE / "App.xcodeproj" / "project.pbxproj"
SOURCES = HERE / "App" / "Native"


def fail(message: str) -> None:
    print(f"  ✗ {message}")


def main() -> int:
    if not PROJECT.exists():
        fail(f"no project file at {PROJECT}")
        return 1

    text = PROJECT.read_text()
    problems = 0

    # 1. Conflict markers. Checked first and by hand, because a file with
    #    markers in it will not parse and every later check would blame the
    #    wrong thing.
    for marker in ("<<<<<<<", "=======", ">>>>>>>"):
        # `=======` also appears in no legitimate pbxproj line, but check it
        # only alongside the others to avoid tripping on some future comment.
        if marker == "=======" and "<<<<<<<" not in text:
            continue
        if marker in text:
            lines = [i + 1 for i, line in enumerate(text.splitlines()) if marker in line]
            fail(f"conflict marker {marker} at line(s) {lines}")
            problems += 1
    if problems:
        return 1

    # 2. It has to parse. plutil is the same reader Xcode uses.
    lint = subprocess.run(
        ["plutil", "-lint", str(PROJECT)], capture_output=True, text=True
    )
    if lint.returncode != 0:
        fail(f"does not parse: {lint.stdout.strip() or lint.stderr.strip()}")
        return 1

    # 3. Duplicate object ids.
    ids = re.findall(r"^\t\t([0-9A-F]{24}) /\* (.+?) \*/ = \{isa = (\w+)", text, re.M)
    seen: dict[str, str] = {}
    for uid, name, isa in ids:
        if uid in seen:
            fail(f"duplicate id {uid}: {seen[uid]} and {name} ({isa})")
            problems += 1
        else:
            seen[uid] = name

    # 4. Every Swift source on disk is both known and compiled.
    #    Known = a PBXFileReference. Compiled = its build file appears in the
    #    Sources phase. The second is the one that fails silently.
    sources_phase = re.search(
        r"isa = PBXSourcesBuildPhase;.*?files = \((.*?)\);", text, re.S
    )
    if not sources_phase:
        fail("no Sources build phase found")
        return 1
    compiled = sources_phase.group(1)

    for swift in sorted(SOURCES.glob("*.swift")):
        rel = f"Native/{swift.name}"
        ref = re.search(
            rf"([0-9A-F]{{24}}) /\* {re.escape(swift.name)} \*/ = "
            rf"\{{isa = PBXFileReference;[^}}]*path = {re.escape(rel)};",
            text,
        )
        if not ref:
            fail(f"{rel} is on disk but not registered — run add-sources.py {rel}")
            problems += 1
            continue
        if f"/* {swift.name} in Sources */" not in compiled:
            fail(f"{rel} is registered but never compiled — not in the Sources phase")
            problems += 1

    if problems:
        print(f"\n{problems} problem(s) in {PROJECT.name}")
        return 1

    count = len(list(SOURCES.glob("*.swift")))
    print(f"  ✓ project file parses, ids unique, {count} Native sources all compiled")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
