/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// This configuration file is used to generate the full documentation, including
// private information. The `jsdoc-conf.jsonc` is used as a baseline, as that
// is the configuration for our public API docs.

const fs = require('node:fs')
const baselineData = fs.readFileSync('./jsdoc-conf.jsonc').toString('utf-8')
const config = JSON.parse(
  baselineData
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('//') === false)
    .join('\n')
)

// We want everything in `lib/` for our internal docs.
config.source.include.push('lib/')

delete config.opts.template
delete config.opts.theme_opts

module.exports = config
