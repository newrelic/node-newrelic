/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const dc = require('node:diagnostics_channel')
const resolvePackageVersion = require('../../../../../lib/subscribers/resolve-package-version')
const Baz = require('./baz/index.js')

dc.subscribe('baz.test', handler)
const baz = new Baz()
baz.baz()

function handler() {
  const version = resolvePackageVersion('baz')
  console.log(version)
  process.exit(0)
}
