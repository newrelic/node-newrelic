/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')
const { queryParser } = require('../../db/query-parsers/elasticsearch')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const diagCh = require('node:diagnostics_channel')
const recordQueryMetrics = require('../../../lib/metrics/recorders/database')
const ParsedStatement = require('#agentlib/db/parsed-statement.js')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const channels = diagCh.tracingChannel('nr-ch')

/**
 * Instruments the `@elastic/elasticsearch` module. This function is
 * passed to `onRequire` when instantiating instrumentation.
 *
 * @param {object} _agent New Relic agent
 * @param agent
 * @param {object} elastic resolved module
 * @param {string} _moduleName string representation of require/import path
 * @param {object} shim New Relic shim
 * @returns {void}
 */
module.exports = function initialize(agent, elastic, _moduleName, shim) {
  const pkgVersion = shim.pkgVersion
  if (semver.lt(pkgVersion, '7.16.0')) {
    shim &&
      shim.logger.debug(
        `ElasticSearch support is for versions 7.16.0 and above. Not instrumenting ${pkgVersion}.`
      )
    return
  }

  shim.setDatastore(shim.ELASTICSEARCH)

  channels.start.bindStore(agent.tracer._contextManager._asyncLocalStorage, (data) => {
    const { thisArg, args } = data

    const ctx = agent.tracer.getContext()

    if (ctx?.transaction) {
      const query = JSON.stringify(args?.[0])
      const parsed = queryParser(query)

      const queryRecorded =
        agent.config.transaction_tracer.record_sql === 'raw' ||
        agent.config.transaction_tracer.record_sql === 'obfuscated'

      const parsedStatement = new ParsedStatement(
        'ElasticSearch',
        parsed.operation,
        parsed.collection,
        queryRecorded ? parsed.query : null
      )
      const name = (parsed.collection || 'other') + '/' + parsed.operation

      const segment = agent.tracer.createSegment({
        name: shim._metrics.STATEMENT + name,
        parent: ctx.segment,
        query: JSON.stringify(args?.[0]),
        transaction: ctx.transaction,
        recorder: recordQueryMetrics.bind(parsedStatement)
      })

      // captureInstanceAttributes is checking segment id for shimId
      if (segment) {
        segment.shimId = shim.id
      }

      const newCtx = ctx.enterSegment({ segment })
      getConnection.call(thisArg, shim, segment)
      return newCtx
    }
  })

  channels.subscribe({
    asyncEnd(message) {
      const ctx = agent.tracer.getContext()
      ctx?.segment?.end()
    }
  })

  shim.wrap(elastic.Transport.prototype, 'request', function wrapQuery(shim, orig) {
    return function wrappedRequest() {
      return channels.tracePromise(orig, { thisArg: this, args: arguments }, this, ...arguments)
    }
  })
}

/**
 * Convenience function for deriving connection information from
 * elasticsearch
 *
 * @param {object} shim The New Relic datastore-shim
 * @param segment
 * @returns {Function} captureInstanceAttributes method of shim
 */
function getConnection(shim, segment) {
  const connectionPool = this.connectionPool.connections[0]
  const host = connectionPool.url.host.split(':')
  const port = connectionPool.url.port || host?.[1]

  // TODO: fix segment - wrong segment on shim
  // tmp passing segment
  return shim.captureInstanceAttributes(host[0], port, undefined, segment)
}

module.exports.getConnection = getConnection
