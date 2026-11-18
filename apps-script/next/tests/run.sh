#!/bin/bash
# بيشغّل اختبارات المراجعة على الكود الشغال (feature/system-upgrade) + ملفات apps-script/next. مفيش أي اتصال حقيقي.
set -e
cd "$(dirname "$0")" && cd "$(git rev-parse --show-toplevel)"
git fetch -q origin feature/system-upgrade
T=$(mktemp -d)
for f in $(git ls-tree --name-only origin/feature/system-upgrade apps-script/ | grep '\.gs$'); do
  git show "origin/feature/system-upgrade:$f" > "$T/$(basename "$f")"
done
cp apps-script/next/*.gs "$T/"
node apps-script/next/tests/tests.js "$T"
rm -rf "$T"
