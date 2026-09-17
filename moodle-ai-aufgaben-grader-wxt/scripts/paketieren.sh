#!/bin/bash
# Baut alle drei Browser-Versionen und packt sie zusammen mit
# der README.md aus diesem Projektordner zu dist/moodle-ai-aufgaben-grader.zip im
# Repo-Wurzelordner.
# Aufruf:  bash scripts/paketieren.sh   (oder: npm run paket)
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

NAME="moodle-ai-aufgaben-grader"
OUT="Erweiterung"

# Reste eines frueheren Durchlaufs ZUERST weg — seit die Builds direkt in die
# benannten Ordner schreiben, wuerde ein Aufraeumen danach das frische Ergebnis
# loeschen (17.09.2026).
for b in chrom firefox edge; do rm -rf "$OUT/$NAME-$b"; done

npm run build-all

# README ist im Repo verfolgt (Erweiterung/ selbst ist gitignored, siehe .gitignore)
cp "README.md" "$OUT/README.md"

# zip kann nicht immer in einen gemounteten Ordner schreiben (Temp-Datei + Umbenennen);
# deshalb ausserhalb bauen und hineinkopieren, wie in zips-bauen.sh im Repo-Wurzelordner.
WORK="${TMPDIR:-/tmp}/zipwork.$$"; rm -rf "$WORK"; mkdir -p "$WORK/staging/$OUT" "$WORK/out"
(cd "$OUT" && find . \( -name '.DS_Store' -o -name '*.bak' \) -prune -o -type f -print) \
  | sed 's|^\./||' | while read -r f; do
      mkdir -p "$WORK/staging/$OUT/$(dirname "$f")"; cp "$OUT/$f" "$WORK/staging/$OUT/$f"
    done
(cd "$WORK/staging" && zip -q -r -X "$WORK/out/$NAME.zip" "$OUT")
REPO_ROOT="$(cd "$DIR/.." && pwd)"
mkdir -p "$REPO_ROOT/dist"
cp "$WORK/out/$NAME.zip" "$REPO_ROOT/dist/$NAME.zip"
rm -rf "$WORK"

echo "dist/$NAME.zip aktualisiert."
