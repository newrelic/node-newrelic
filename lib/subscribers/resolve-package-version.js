/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('node:path')
const defaultLogger = require('#agentlib/logger.js').child({
  component: 'resolve-module-version'
})

module.exports = resolveModuleVersion

/**
 * Given a module name, attempt to read the version string from its
 * associated package manifest. If the module is a built-in, or one that has
 * been bundled with Node.js (e.g. `undici`), a package manifest will not be
 * available. In this case, the string "unknown" will be returned.
 *
 * @param {string} moduleSpecifier What would be passed to `resolve()`.
 * @param {object} [deps] Optional dependencies.
 * @param {object} [deps.logger] Agent logger instance.
 * @param {Function} [deps.req] Node.js require function.
 *
 * @returns {string} The version string from the package manifest or "unknown".
 */
function resolveModuleVersion(moduleSpecifier, {
  logger = defaultLogger,
  req = require
} = {}) {
  let pkgPath
  try {
    pkgPath = req.resolve(moduleSpecifier)
  } catch {
    logger.warn(
      { moduleSpecifier },
      'Could not resolve module path. Possibly a built-in or Node.js bundled module.'
    )
    return 'unknown'
  }

  const cwd = process.cwd()
  let reachedCwd = false
  let pkg
  let base = path.dirname(pkgPath)
  do {
    try {
      pkgPath = path.join(base, 'package.json')
      pkg = req(pkgPath)
    } catch {
      base = path.resolve(path.join(base, '..'))
      if (base === cwd) {
        reachedCwd = true
      } else if (reachedCwd === true) {
        // We reached the supposed app root, attempted to load a manifest
        // file in that location, and still couldn't find one. So we give up.
        pkg = {}
      }
    }
  } while (!pkg)

  const version = pkg.version ?? 'unknown'
  logger.trace({ moduleSpecifier, version }, 'Resolved package version.')
  return version
}
