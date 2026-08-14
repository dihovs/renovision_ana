#!/usr/bin/env python3
"""
Register Swift files with the Xcode target.

This project uses classic file references, which means a .swift file sitting
in the folder is NOT compiled until three separate entries exist for it in
project.pbxproj: a PBXFileReference, a PBXBuildFile, and a line in the
target's Sources build phase — plus membership of the group so it is visible
in Xcode's navigator.

That is not pedantry. SpeakerPlugin.swift once sat in this folder for a whole
build cycle without being compiled, and the symptom was a plugin that "did
not exist" at runtime on a phone that was working perfectly. Adding files by
hand invites that failure every time; this does it the same way each time.

Idempotent: a file already registered is skipped, so this can be re-run after
adding more sources.

    python3 add-sources.py Native/API.swift Native/Models.swift
"""

import hashlib
import re
import sys
from pathlib import Path

PROJECT = Path(__file__).parent / "App.xcodeproj" / "project.pbxproj"


def uid(seed: str) -> str:
    """A stable 24-hex-char id. Derived from the path so re-running produces
    the same id rather than a duplicate entry with a new one."""
    return hashlib.sha1(seed.encode()).hexdigest()[:24].upper()


def main(paths: list[str]) -> int:
    if not paths:
        print("usage: add-sources.py <file.swift> [...]", file=sys.stderr)
        return 2

    text = PROJECT.read_text()
    added = []

    for rel in paths:
        name = Path(rel).name
        if f"path = {rel};" in text or (f"path = {name};" in text and "/" not in rel):
            print(f"  = {rel} (already registered)")
            continue

        file_ref = uid(f"ref:{rel}")
        build_ref = uid(f"build:{rel}")

        # 1. PBXFileReference — the file exists as far as the project is
        #    concerned. `path` is relative to the group's own path.
        text = text.replace(
            "/* End PBXFileReference section */",
            f'\t\t{file_ref} /* {name} */ = {{isa = PBXFileReference; '
            f'lastKnownFileType = sourcecode.swift; path = {rel}; sourceTree = "<group>"; }};\n'
            "/* End PBXFileReference section */",
            1,
        )

        # 2. PBXBuildFile — the file is an input to some build phase.
        text = text.replace(
            "/* End PBXBuildFile section */",
            f"\t\t{build_ref} /* {name} in Sources */ = {{isa = PBXBuildFile; "
            f"fileRef = {file_ref} /* {name} */; }};\n"
            "/* End PBXBuildFile section */",
            1,
        )

        # 3. The Sources phase — without this the file is known but never
        #    compiled, which is exactly the silent failure described above.
        text = re.sub(
            r"(isa = PBXSourcesBuildPhase;.*?files = \(\n)",
            rf"\1\t\t\t\t{build_ref} /* {name} in Sources */,\n",
            text,
            count=1,
            flags=re.S,
        )

        # 4. Group membership, so it is visible in Xcode. Anchored on a file
        #    that is already in the App group.
        text = text.replace(
            "\t\t\t\tAA1000000000000000000001 /* SpeakerPlugin.swift */,",
            f"\t\t\t\tAA1000000000000000000001 /* SpeakerPlugin.swift */,\n"
            f"\t\t\t\t{file_ref} /* {name} */,",
            1,
        )

        added.append(rel)
        print(f"  + {rel}")

    if added:
        PROJECT.write_text(text)
    print(f"{len(added)} file(s) registered.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
