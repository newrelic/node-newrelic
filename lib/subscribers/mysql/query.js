/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('../db-query.js')
const channels = require('./channels.js')

class MysqlQuerySubscriber extends DbQuerySubscriber {
  constructor({ ...rest }) {
    super({ packageName: 'mysql', channelName: channels.QUERY, system: 'mysql', ...rest })
  }

  handler(data, ctx) {
    console.log('!!! wtf')
    const { self: conn, arguments: args } = data
    this.queryString = args[0]
    // TODO: determine if `USE` statements should affect the `database_name`
    // See dbutils.extractDatabaseChangeFromUse
    this.parameters = getParameters(conn.config)

    super.handler(data, ctx)
  }
}

function getParameters(config) {
  /* eslint-disable camelcase, eqeqeq */
  let host = 'localhost'
  let port_path_or_id = config.socketPath

  if (port_path_or_id == undefined) {
    host = config.host
    port_path_or_id = config.port
  }

  return {
    database_name: config.database,
    host,
    port_path_or_id
  }
}

module.exports = MysqlQuerySubscriber
