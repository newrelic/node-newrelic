/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const { glob: fsGlob } = require('node:fs/promises')

function buildGlobs(testGlobs, patterns = []) {
  // Turn the given globs into searches for package.json files.
  const globs = []
  for (let glob of testGlobs) {
    if (/^["']/.test(glob[0]) && /["']$/.test(glob.slice(-1)[0])) {
      glob = glob.slice(1, -1) // strip quotes
    }
    if (/(?:package\.json|\.js)$/.test(glob)) {
      globs.push(glob)
      if (/\.js$/.test(glob) && !/\*/.test(glob)) {
        // is a specific js file and not a glob expression
        patterns.push(path.basename(glob))
      }
    } else {
      globs.push(path.join(glob, 'package.json'))
      globs.push(path.join(glob, '**/package.json'))
    }
  }

  // If no globs were given, then look for globs in the default paths.
  if (!globs.length) {
    const cwd = process.cwd()
    globs.push(path.join(cwd, 'test/versioned/**/package.json'))
    globs.push(path.join(cwd, 'tests/versioned/**/package.json'))
    globs.push(path.join(cwd, 'node_modules/**/tests/versioned/package.json'))
    globs.push(path.join(cwd, 'node_modules/**/tests/versioned/**/package.json'))
  }

  return globs
}

async function resolveGlobs(globs, skip = []) {
  const allFiles = []
  const seen = new Set()

  for (const pattern of globs) {
    // Ensure the pattern is absolute so fs.glob returns absolute paths
    const absPattern = path.isAbsolute(pattern) ? pattern : path.resolve(pattern)
    for await (const file of fsGlob(absPattern)) {
      // Filter out any package.json files from our `node_modules` directory
      // which aren't from the `@newrelic` scope.
      const inNodeModules = /\/node_modules\/(?!@newrelic\/)/g.test(file)

      if (!inNodeModules && !seen.has(file)) {
        const shouldSkip = skip.some((s) => file.includes(s))
        if (!shouldSkip) {
          seen.add(file)
          allFiles.push(file)
        }
      }
    }
  }

  return allFiles
}

module.exports = {
  buildGlobs,
  resolveGlobs
}
