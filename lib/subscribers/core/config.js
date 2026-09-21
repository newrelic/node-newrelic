/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Core modules that have been migrated to a subscriber. Each name resolves to
// `./core/<name>`, so a subscriber can be a single file or a directory with an
// `index.js`. A module needing more than one subscriber gets its own entry in
// `lib/subscriber-configs.js` instead.
const CORE_PACKAGES = ['child_process', 'dns']

module.exports = Object.fromEntries(
  CORE_PACKAGES.map((pkg) => [pkg, [{ path: `./core/${pkg}`, instrumentations: [] }]])
)
