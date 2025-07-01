/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../logger').child({ component: 'get-package-version' })
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const packageVersions = new Map()

function getPackageVersion(baseDir, moduleName) {
  if (packageVersions.has(baseDir)) {
    return packageVersions.get(baseDir)
  }

  try {
    const packageJsonPath = join(baseDir, 'package.json')
    const jsonFile = readFileSync(packageJsonPath)
    const { version } = JSON.parse(jsonFile)
    packageVersions.set(baseDir, version)
    return version
  } catch (error) {
    logger.error({ error }, `Error reading package.json for ${moduleName}`)
  }
}

module.exports = getPackageVersion
