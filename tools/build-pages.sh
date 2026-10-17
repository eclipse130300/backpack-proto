#!/usr/bin/env bash
# Сборка сайта для GitHub Pages из ВСЕХ веток репозитория (запускается GitHub Actions, см. .github/workflows/pages.yml).
#   main            → корень сайта        https://eclipse130300.github.io/backpack-proto/
#   любая ветка X   → папка /x/           https://eclipse130300.github.io/backpack-proto/x/
# Имя папки = имя ветки маленькими буквами, всё кроме a-z 0-9 - заменяется на "-" (balance/2026-10-17 → balance-2026-10-17).
# В index.html и cards.html каждой версии вписывается window.BP_BRANCH (см. js/version.js).
# В корне создаётся versions.html — список всех версий со ссылками.
# Запуск руками: bash tools/build-pages.sh _site   (SKIP_FETCH=1 — не обновлять ветки с GitHub)
set -euo pipefail

OUT="${1:-_site}"
export TZ="Europe/Budapest"
rm -rf "$OUT"
mkdir -p "$OUT"

if [ "${SKIP_FETCH:-}" != "1" ]; then
  git fetch --prune origin '+refs/heads/*:refs/remotes/origin/*'
fi

esc() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

ROWS_MAIN=""
ROWS=""
for ref in $(git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/remotes/origin); do
  b="${ref#origin/}"
  [ "$b" = "HEAD" ] || [ "$b" = "origin" ] && continue
  if [ "$b" = "main" ]; then
    dir=""; dest="$OUT"; href="./"
  else
    dir="$(printf '%s' "$b" | tr 'A-Z' 'a-z' | sed -e 's/[^a-z0-9-]/-/g')"
    # Эти имена заняты папками самой игры
    case " css js tools " in *" $dir "*) echo "Пропуск ветки $b: имя папки занято"; continue;; esac
    dest="$OUT/$dir"; href="$dir/"
  fi
  mkdir -p "$dest"
  git archive "$ref" | tar -x -C "$dest"
  rm -rf "$dest/.github"
  for f in "$dest/index.html" "$dest/cards.html"; do
    [ -f "$f" ] && sed -i "0,/<script/s//<script>window.BP_BRANCH = \"$dir\";<\/script>\n  <script/" "$f"
  done
  when="$(git log -1 --format='%cd' --date=format:'%d.%m.%Y %H:%M' "$ref")"
  msg="$(git log -1 --format='%s' "$ref" | esc)"
  name="$(printf '%s' "$b" | esc)"
  row="<tr><td><a href=\"$href\"><b>$name</b></a></td><td><a href=\"${href}cards.html\">карты</a></td><td class=\"m\">$when</td><td class=\"m\">$msg</td></tr>"
  if [ "$b" = "main" ]; then ROWS_MAIN="$row"; else ROWS="$ROWS$row"; fi
  echo "Ветка $b → /${dir}"
done

cat > "$OUT/versions.html" <<EOF
<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Backpack RPG — версии</title>
<style>
body{font:16px system-ui,sans-serif;background:#16141a;color:#e8e4ee;margin:40px}
h1{font-size:22px} a{color:#9fc4ff} table{border-collapse:collapse} td{padding:8px 14px;border-bottom:1px solid #333}
.m{color:#9a94a6;font-size:14px} p{color:#9a94a6;max-width:760px}
</style></head><body>
<h1>Backpack RPG — все версии прототипа</h1>
<p>Каждая ветка репозитория — отдельная версия со своей ссылкой, своим конфигом, картами и настройками ⚙. main — основная игра. Сверху — недавно изменённые.</p>
<table>$ROWS_MAIN$ROWS</table>
</body></html>
EOF
touch "$OUT/.nojekyll"
echo "Готово: $OUT"
