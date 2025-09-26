/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const channels = require('./channels.js')

const createConnection = {
  path: './mysql/create-connection.js',
  instrumentations: [{
    channelName: 'nr_mysql_create_connection',
    module: { name: 'mysql', versionRange: '>=2.16.0', filePath: 'index.js' },
    functionQuery: {
      expressionName: 'createConnection',
      kind: 'Sync'
    }
  }]
}

const query = {
  path: './mysql/query.js',
  instrumentations: [{
    channelName: channels.QUERY,
    module: { name: 'mysql', versionRange: '>=2.16.0', filePath: 'lib/Connection.js' },
    functionQuery: {
      expressionName: 'query',
      kind: 'Async'
    }
  }]
}

module.exports = {
  mysql: [
    query
  ]
}
