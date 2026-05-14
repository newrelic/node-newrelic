/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * Reads the version field from a package's manifest relative to a given
 * base directory. This avoids errors when trying to read a package's
 * manifest when that package defines an exports map that does not include
 * itself.
 *
 * @param {object} params Function parameters.
 * @param {string} params.pkgName The name of the package to look for in
 * the given base directory.
 * @param {string} params.baseDir Should be the value of `__dirname` for the
 * invoking script, but can be any directory name. If it does not end with
 * 'node_modules', it will be appended.
 * @param {boolean} [params.returnProcessVersion] If there is an
 * error in reading the manifest file, the process version will be returned
 * when this is `true`.
 *
 * @returns {string|undefined}
 */
module.exports = function getPackageVersion({
  pkgName,
  baseDir,
  returnProcessVersion = false
}) {
  const root = path.dirname(baseDir) === 'node_modules'
    ? baseDir
    : path.join(baseDir, 'node_modules')
  const resolvedPath = path.resolve(path.join(root, pkgName, 'package.json'))
  try {
    // We cannot `require(json)` here because some packages defined an exports
    // map which prohibits access to the manifest file. We need to
    // circumvent that.
    const pkg = fs.readFileSync(resolvedPath)
    const { version } = JSON.parse(pkg)
    return version
  } catch {
    return returnProcessVersion === true
      ? process.version.slice(1)
      : undefined
  }
}
