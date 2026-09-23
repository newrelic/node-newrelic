/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  child_process: [{ path: './core/child_process', instrumentations: [] }],

  crypto: [{ path: './core/crypto', instrumentations: [] }],

  dns: [{ path: './core/dns', instrumentations: [] }],

  zlib: [{ path: './core/zlib', instrumentations: [] }]
}
