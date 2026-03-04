/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Primary way to instantiate winston logger.
const createLogger = {
  path: './winston/create-logger',
  instrumentations: [{
    channelName: 'nr_createLogger',
    module: { name: 'winston', versionRange: '>=3', filePath: 'lib/winston/create-logger.js' },
    functionQuery: {
      className: 'DerivedLogger',
      methodName: 'constructor',
      kind: 'Sync'
    }
  }]
}

// If user uses winston.add to create new logger, we'll have to
// instrument this method as well.
const add = {
  path: './winston/add',
  instrumentations: [{
    channelName: 'nr_add',
    module: { name: 'winston', versionRange: '>=3', filePath: 'lib/winston/container.js' },
    functionQuery: {
      className: 'Container',
      methodName: 'add',
      kind: 'Sync'
    }
  }]
}

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
    createLogger,
    add,
    configure
  ]
}
