/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbQuerySubscriber = require('../db-query')
const { MYSQL } = require('#agentlib/metrics/names.js')
const symbols = require('../../symbols')
const { EventEmitter } = require('node:events')

/**
 * Subscribes to `mysql`'s `Connection#query` events and creates the
 * coordinating Datastore query segment.
 *
 * Also provides a base for other `Connection#query` subscribers.
 */
class MySQLConnectionQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_connectionQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName, system: MYSQL.PREFIX })
    this.events = ['asyncStart', 'asyncEnd', 'end']
    this.operation = 'query'
    this.callback = -1
    this.propagateContext = true
  }

  handler(data, ctx) {
    const Connection = data?.self
    // Setting this symbol is necessary because we
    // may need to track the databaseName across multiple
    // consecutive queries; see `getInstanceParameters`.
    Connection[symbols.storeDatabase] = true

    // Set database attributes
    this.queryString = this.#extractQuery(data?.arguments)
    this.parameters = this.#getInstanceParameters(Connection)
    this.parameters.product = this.system

    // Call DbQuerySubscriber.handler to make the segment
    return super.handler(data, ctx)
  }

  end(data) {
    const ctx = this.agent.tracer.getContext()
    if (ctx?.transaction?.isActive() !== true) {
      return
    }

    if (data?.result instanceof EventEmitter) {
      const ctx = this.agent.tracer.getContext()
      this.wrapEventEmitter({ args: data, index: 'result', ctx })
    }
  }

  /**
   * Extracts the query string from the function arguments.
   * @param {Array} args the original query arguments
   * @returns {string} the extracted query string
   */
  #extractQuery(args) {
    let query = ''
    // Figure out the query parameter.
    if (args[0] && typeof args[0] === 'string') {
      // query(sql [, values], callback)
      query = args[0]
    } else {
      // query(opts [, values], callback)
      query = args[0].sql
    }

    return query
  }

  #getInstanceParameters(Connection) {
    const parameters = {}
    let conf = Connection.config
    conf = conf?.connectionConfig || conf
    const databaseName = Connection[symbols.databaseName] || null

    // Look at config for parameters
    if (conf) {
      parameters.database_name = databaseName || conf.database

      if (Object.prototype.hasOwnProperty.call(conf, 'socketPath') && conf.socketPath) {
        // In the unix domain socket case we force the host to be localhost
        parameters.host = 'localhost'
        parameters.port_path_or_id = conf.socketPath
      } else {
        parameters.host = conf.host
        parameters.port_path_or_id = conf.port
      }
    } else {
      this.logger.trace('No query config detected, not collecting db instance data')
    }

    this.#storeDatabaseName(Connection)
    return parameters
  }

  #storeDatabaseName(Connection) {
    if (Connection[symbols.storeDatabase]) {
      const databaseName = this.extractDatabaseChangeFromUse()
      if (databaseName) {
        Connection[symbols.databaseName] = databaseName
      }
    }
  }

  /**
   * The character ranges for this were pulled from
   * see: http://dev.mysql.com/doc/refman/5.7/en/identifiers.html
   *
   * **Note**: Only public method to make it easier to test
   *
   * @returns {string|null} extracted database or null if cannot match a db
   */
  extractDatabaseChangeFromUse() {
    // The lint rule being suppressed here has been evaluated, and it has been
    // determined that the regular expression is sufficient for our use case.
    // eslint-disable-next-line sonarjs/slow-regex
    const match = /^\s*use[^\w`]+([\w$\u0080-\uFFFF]+|`[^`]+`)[\s;]*$/i.exec(this.queryString)
    return (match && match[1]) || null
  }
}

module.exports = MySQLConnectionQuerySubscriber
