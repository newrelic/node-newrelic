/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { QuerySpec } = require('../../shim/specs')
const semver = require('semver')
const { queryParser } = require('../../db/query-parsers/elasticsearch')

/**
 * Instruments the `@elastic/elasticsearch` module. This function is
 * passed to `onRequire` when instantiating instrumentation.
 *
 * @param {object} _agent New Relic agent
 * @param {object} elastic resolved module
 * @param {string} _moduleName string representation of require/import path
 * @param {object} shim New Relic shim
 * @returns {void}
 */
module.exports = function initialize(_agent, elastic, _moduleName, shim) {
  const pkgVersion = shim.pkgVersion
  if (semver.lt(pkgVersion, '7.16.0')) {
    shim &&
      shim.logger.debug(
        `ElasticSearch support is for versions 7.16.0 and above. Not instrumenting ${pkgVersion}.`
      )
    return
  }

  shim.setDatastore(shim.ELASTICSEARCH)
  shim.setParser(queryParser)

  shim.recordQuery(elastic.Transport.prototype, 'request', function wrapQuery(shim, _, __, args) {
    const ctx = this
    return new QuerySpec({
      query: JSON.stringify(args?.[0]),
      promise: true,
      opaque: true,
      inContext: function inContext() {
        getConnection.call(ctx, shim)
      }
    })
  })
}

/**
 * Convenience function for deriving connection information from
 * elasticsearch
 *
 * @param {object} shim The New Relic datastore-shim
 * @returns {Function} captureInstanceAttributes method of shim
 */
function getConnection(shim) {
  const connectionPool = this.connectionPool.connections[0]
  const host = connectionPool.url.host.split(':')
  const port = connectionPool.url.port || host?.[1]
  return shim.captureInstanceAttributes(host[0], port)
}

module.exports.getConnection = getConnection
