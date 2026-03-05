/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// configure() is on Logger (parent of DerivedLogger) in logger.js.
// It's called during initial construction and whenever the user reconfigures.
// We hook it to ensure NrTransport is always present after transports are set up.
const configure = {
  path: './winston/configure',
  instrumentations: [{
    channelName: 'nr_configure',
    module: { name: 'winston', versionRange: '>=3', filePath: 'lib/winston/logger.js' },
    functionQuery: {
      className: 'Logger',
      methodName: 'configure',
      kind: 'Sync'
    }
  }]
}

module.exports = {
  winston: [
    configure
  ]
}
