#! /bin/sh

PACKAGE_VERSION=$(node -e 'console.log(require("./package").version)')

git checkout gh-pages
git pull origin gh-pages
git merge -
make public-docs
git rm -r docs
mv out docs
git add docs
git commit -m "docs: update for ${PACKAGE_VERSION}"
git push origin gh-pages && git push public gh-pages:gh-pages