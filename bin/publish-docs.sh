#! /bin/sh
set -ex

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

PACKAGE_VERSION=$(node -e 'console.log(require("./package").version)')

git fetch origin gh-pages
git checkout gh-pages
git checkout main
git branch -fd gh-pages
git checkout -b gh-pages
npm run public-docs
sleep 1
mv out docs
sleep 1
git add docs
git commit -m "docs: update for ${PACKAGE_VERSION}"
git push --force origin gh-pages
