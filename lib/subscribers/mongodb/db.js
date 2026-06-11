/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbSubscriber = require('../db.js')
const genericRecorder = require('#agentlib/metrics/recorders/generic.js')
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

module.exports = class DbClassSubscriber extends DbSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_db',
      packageName: 'mongodb',
      system: MONGODB_METRIC_CONSTANTS.PREFIX
    })

    this.events = ['end']
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

      this.#wrapMethod(dbClient, method)
    }

    return ctx
  }

  #wrapMethod(instance, methodName) {
    const self = this
    const orig = instance[methodName]

    instance[methodName] = function nrWrappedMethod(...args) {
      let ctx = self.agent.tracer.getContext()
      if (ctx.transaction == null || ctx.transaction.isActive() === false) {
        self.logger.debug(
          'Not recording function %s, not in a transaction',
          methodName
        )
        return orig.apply(instance, args)
      }

      self.logger.debug('Recording function %s', methodName)
      const segmentAttributes = {}
      if (ADMIN_COMMANDS.includes(methodName) === true) {
        segmentAttributes.database_name = 'admin'
      }
      ctx = self.createSegment({
        name: `${DB_METRIC_CONSTANTS.OPERATION}/${self.system}/${methodName}`,
        recorder: genericRecorder,
        attributes: segmentAttributes,
        ctx
      })
      return self.agent.tracer.runInContext({
        handler: orig,
        context: ctx,
        full: true,
        thisArg: instance,
        args
      })
    }
  }
}
