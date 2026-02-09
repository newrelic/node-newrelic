/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = readPackageVersion

const fs = require('node:fs')
const path = require('node:path')

/**
 * Used to get version from package.json.
 * Some packages define exports and omit `package.json` so `require` or `import`
 * will fail when trying to read package.json. This instead just reads file and parses to json
 *
 * @param {string} dirname value of `__dirname` in caller
 * @param {string} pkg name of package
 * @returns {string} package version
 */
function readPackageVersion(dirname, pkg) {
  const parsedPath = path.join(dirname, 'node_modules', pkg, 'package.json')
  const packageFile = fs.readFileSync(parsedPath)
  const { version } = JSON.parse(packageFile.toString())
  return version
}
