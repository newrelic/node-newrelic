/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const basicTests = require('../mysql/basic')
const constants = require('./constants')
const fs = require('node:fs')
const path = require('node:path')

// certain versions of mysql2 lack an export for the package.json
// so require('mysql2/package.json') will not work
function getPkgVersion() {
  const resolvedPath = path.join(__dirname, '/node_modules/mysql2/package.json')
  const result = fs.readFileSync(resolvedPath)
  const { version } = JSON.parse(result.toString())
  return version
}

basicTests({
  lib: 'mysql2',
  factory: () => require('mysql2'),
  version: getPkgVersion(),
  poolFactory: () => require('generic-pool'),
  constants
})
