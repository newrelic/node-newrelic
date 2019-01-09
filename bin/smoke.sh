#! /bin/sh

npm install --production --loglevel warn --no-package-lock
npm --prefix test/smoke install --no-package-lock
time node test/smoke/*.tap.js