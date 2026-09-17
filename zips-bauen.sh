#!/bin/bash
# Baut die Download-ZIPs unter dist/ aus den Erweiterungsordnern dieses Repos neu.
# Der frühere Kopierschritt (Arbeitskopie -> Repo) entfällt: gearbeitet wird direkt hier.
# Aufruf:  bash "zips-bauen.sh"
set -e
REPO="$(cd "$(dirname "$0")" && pwd)"
# Aufgaben-Grader UND Coach stehen NICHT in dieser Liste: beide werden mit WXT
# gebaut und bringen ihr eigenes Paketierskript mit
#   (moodle-ai-aufgaben-grader-wxt: npm run paket, moodle-ai-coach-wxt: npm run paket).
# Beide schreiben dieselben Dateinamen wie bisher: dist/moodle-ai-aufgaben-grader.zip
# bzw. dist/moodle-ai-coach.zip.
NAMEN="moodle-ai-grader moodle-ai-reviewer moodle-cloze-autofill notenstufen-extension"

# zip kann nicht in jeden gemounteten Ordner schreiben (Temp-Datei + Umbenennen).
# Deshalb ausserhalb bauen und hineinkopieren.
WORK="${TMPDIR:-/tmp}/zipwork.$$"; rm -rf "$WORK"; mkdir -p "$WORK/staging" "$WORK/out"
mkdir -p "$REPO/dist"
for d in $NAMEN; do
  [ -d "$REPO/$d" ] || { echo "  uebersprungen (fehlt): $d"; continue; }
  VER=$(python3 -c "import json;print(json.load(open('$REPO/$d/manifest.json'))['version'])")
  mkdir -p "$WORK/staging/$d"
  (cd "$REPO/$d" && find . \( -name '.DS_Store' -o -name '*.bak' \) -prune -o -type f -print) \
    | sed 's|^\./||' | while read -r f; do
        mkdir -p "$WORK/staging/$d/$(dirname "$f")"; cp "$REPO/$d/$f" "$WORK/staging/$d/$f"
    done
  (cd "$WORK/staging" && zip -q -r -X "$WORK/out/$d.zip" "$d")
  cp "$WORK/out/$d.zip" "$REPO/dist/$d.zip"
  echo "   dist/$d.zip  ->  V$VER"
done
rm -rf "$WORK"

echo
echo "Der Dateiname der ZIP bleibt IMMER gleich — daran haengen die Download-Links."
echo "Naechster Schritt in diesem Ordner:"
echo "  git add -A && git commit -m \"...\" && git push"
