/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('../db-query.js')
const channels = require('./channels.js')

class MysqlQuerySubscriber extends DbQuerySubscriber {
  constructor({ ...rest }) {
    // Note: we set `system` to `MySQL` instead of `mysql` because the system
    // string is used when constructing metric name strings and our tests,
    // as well as potentially customers's alerts, are keyed on the explicit
    // "proper" casing.
    super({ packageName: 'mysql', channelName: channels.QUERY, system: 'MySQL', ...rest })
    this.events = ['asyncStart', 'asyncEnd']
    this.callback = -1
    this.propagateTx = true
  }

  handler(data, ctx) {
    const { self: conn, arguments: args } = data
    this.queryString = args[0]
    // TODO: determine if `USE` statements should affect the `database_name`
    // See dbutils.extractDatabaseChangeFromUse
    this.parameters = getParameters(conn.config)

    // TODO: can we invoke the handler here, get back the emitter, and do things?
    return super.handler(data, ctx)
  }

  /*
  asyncStart(data) {
    return super.asyncStart(data)
  }
  */

  enable() {
    super.enable()
    this.channel.asyncStart.bindStore(this.store, (data) => {
      const { transaction, segment } = data
      const ctx = this.agent.tracer.getContext()
      if (!transaction && segment) {
        this.logger.trace('No active transaction/segment, returning existing context')
        return ctx
      }
      const newCtx = ctx.enterSegment({ transaction, segment })
      return newCtx
    })
  }

  disable() {
    super.disable()
    this.channel.asyncStart.unbindStore(this.store)
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
