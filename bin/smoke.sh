#! /bin/sh

npm install --production --loglevel warn --no-package-lock
npm install tap --no-package-lock
cd test/smoke && npm install --no-package-lock
time node test/smoke/*.tap.js