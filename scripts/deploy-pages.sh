#!/bin/sh
# Test, build, and publish dist/ to the gh-pages branch.
# GitHub Pages serves that branch (Settings → Pages → Deploy from a branch → gh-pages, /).
set -e
cd "$(dirname "$0")/.."
root=$(pwd)
npm test
npm run build
touch dist/.nojekyll
tmp=$(mktemp -d)
cp -R dist/. "$tmp"
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$root" config user.name)" -c user.email="$(git -C "$root" config user.email)" \
  commit -q -m "Deploy $(git -C "$root" rev-parse --short HEAD)"
git push -q -f "$(git -C "$root" remote get-url origin)" gh-pages
cd "$root"
rm -rf "$tmp"
echo "Published. GitHub Pages updates in about a minute."
