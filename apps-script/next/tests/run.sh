#!/bin/bash
# بيشغّل اختبارات المراجعة على الكود اللي بيترفع فعلًا (apps-script/*.gs). مفيش أي اتصال حقيقي.
# (apps-script/next/ نسخة قديمة ومابتترفعش، فالاختبارات مابقتش بتتشغل عليها.)
# الاستخدام: bash apps-script/next/tests/run.sh
set -e
cd "$(dirname "$0")" && cd "$(git rev-parse --show-toplevel)"
git fetch -q origin feature/system-upgrade
T=$(mktemp -d)
mkdir "$T/live" "$T/new"
for f in $(git ls-tree --name-only origin/feature/system-upgrade apps-script/ | grep '\.gs$'); do
  git show "origin/feature/system-upgrade:$f" > "$T/live/$(basename "$f")"
done
cp "$T"/live/*.gs "$T/new/"
cp apps-script/*.gs "$T/new/"
node apps-script/next/tests/tests.js "$T/new" "$T/live"
rm -rf "$T"
