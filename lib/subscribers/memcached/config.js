/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const command = {
  path: './memcached/command.js',
  instrumentations: [{
    channelName: 'nr_command',
    module: { name: 'memcached', versionRange: '>=2', filePath: 'lib/memcached.js' },
    functionQuery: {
      // memcached.command = function memcachedCommand(queryCompiler, server) { ... }
      expressionName: 'command',
      kind: 'Sync'
    }
  }]
}

module.exports = {
  memcached: [
    command
  ]
}
