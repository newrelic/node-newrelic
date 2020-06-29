#! /bin/sh

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

npm install --production --loglevel warn --no-package-lock
npm --prefix test/smoke install --no-package-lock
time node test/smoke/*.tap.js