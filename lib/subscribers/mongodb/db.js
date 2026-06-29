/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Wrapper = require('./wrapper.js')
const getHostDetails = require('./utils/get-host-details.js')

const {
  DB: DB_METRIC_CONSTANTS,
  MONGODB: MONGODB_METRIC_CONSTANTS
} = require('#agentlib/metrics/names.js')

const ADMIN_COMMANDS = require('./utils/admin-commands.js')

/**
 * The "Db" class is the primary entrypoint into the mongodb client. Some
 * methods are not present on newer versions of the class, e.g. `addUser`
 * got removed in favor of a direct `command` invocation. This list is a list
 * of all methods we are interested in instrumenting, regardless of client
 * version. As we iterate through the list we will perform a presence check
 * for each method.
 *
 * @type {string[]}
 */
const DB_METHODS = [
  '_executeInsertCommand',
  '_executeQueryCommand',
  'addUser',
  'authenticate',
  'collection',
  'collectionNames',
  'collections',
  'command',
  'createCollection',
  'createIndex',
  'cursorInfo',
  'dereference',
  'dropCollection',
  'dropDatabase',
  'dropIndex',
  'ensureIndex',
  'eval',
  'executeDbAdminCommand',
  'indexInformation',
  'logout',
  'open',
  'reIndex',
  'removeUser',
  'renameCollection',
  'stats'
]

module.exports = class DbClassSubscriber extends Wrapper {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_db',
      packageName: 'mongodb',
      system: MONGODB_METRIC_CONSTANTS.PREFIX
    })
  }

  end(data, ctx) {
    const { self: dbClient, arguments: args } = data
    const [dbInstance, dbName] = args
    const details = getHostDetails(dbInstance)
    this.parameters = {
      host: details.host,
      port_path_or_id: details.port_path_or_id,
      database_name: dbName,
      product: this.system
    }

    for (const method of DB_METHODS) {
      if (typeof dbClient[method] !== 'function') {
        continue
      }

      this.wrapDatabaseMethod(dbClient, method, {
        getSegmentName: (method) => `${DB_METRIC_CONSTANTS.OPERATION}/${this.system}/${method}`,
        getRecorderContext: (method) => {
          return {
            operation: method,
            type: this.type
          }
        },
        getSegmentAttributes: (method) => (
          ADMIN_COMMANDS.includes(method)
            ? { database_name: 'admin' }
            : {}
        )
      })
    }

    return ctx
  }
}
