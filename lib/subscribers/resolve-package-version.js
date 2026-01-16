/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('node:path')
const defaultLogger = require('#agentlib/logger.js').child({
  component: 'resolve-module-version'
})

const dcFuncFrame = /^\s*at Channel\.publish/
const modPathReg = /at .+ \((.+):\d+:\d+\)/

module.exports = resolveModuleVersion

/**
 * Given a module name, attempt to read the version string from its
 * associated package manifest. If the module is a built-in, or one that has
 * been bundled with Node.js (e.g. `undici`), a package manifest will not be
 * available. In this case, the string "unknown" will be returned.
 *
 * This version resolver assumes that it will be invoked through our
 * diagnostics channel subscriber instrumentations. That is, it expects the
 * call tree to be similar to:
 *
 * 1. some-module.function()
 * 2. diagnostics_channel.publish()
 * 3. subscriber.handler()
 *
 * @param {string} moduleSpecifier What would be passed to `resolve()`.
 * @param {object} [deps] Optional dependencies.
 * @param {object} [deps.logger] Agent logger instance.
 *
 * @returns {string} The version string from the package manifest or "unknown".
 */
function resolveModuleVersion(moduleSpecifier, { logger = defaultLogger } = {}) {
  let pkgPath
  // We'd prefer to use `require.resolve(moduleSpecifier)` here, but it gets
  // a bit confused when there are non-standard module directories in play.
  // Once we are able to refactor our "on require" metric recording to
  // utilize `module.registerHooks`, we should be able to eliminate this
  // slow algorithm.
  const err = Error()
  const stack = err.stack.split('\n')
  do {
    stack.shift()
  } while (dcFuncFrame.test(stack[0]) === false && stack.length > 0)
  const matches = modPathReg.exec(stack[1])
  pkgPath = matches?.[1]

  if (!pkgPath) {
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
      pkg = require(pkgPath)
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
