/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Assigns the whole `module.exports` object (rather than `exports.config`), so
// `config` is only reachable via the default export, not a hoisted named one.
module.exports = {
  config: {
    high_security: false,

    attributes: {
      enabled: true,
      value_size_limit: 400
    }
  }
}
