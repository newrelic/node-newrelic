/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  child_process: [{ path: './core/child_process', instrumentations: [] }],

  crypto: [{ path: './core/crypto', instrumentations: [] }],

  dns: [{ path: './core/dns', instrumentations: [] }],

  fs: [{ path: './core/fs', instrumentations: [] }],

  globals: [{ path: './core/globals', instrumentations: [] }],

  http: [
    { path: './core/http/server', instrumentations: [] },
    { path: './core/http/agent', instrumentations: [] },
    { path: './core/http/client', instrumentations: [] }
  ],

  http2: [{ path: './core/http2', instrumentations: [] }],

  https: [
    { path: './core/https/server', instrumentations: [] },
    { path: './core/https/agent', instrumentations: [] },
    { path: './core/https/client', instrumentations: [] }
  ],

  net: [{ path: './core/net', instrumentations: [] }],

  zlib: [{ path: './core/zlib', instrumentations: [] }]
}
