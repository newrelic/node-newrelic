/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { QuerySpec } = require('../../shim/specs')
const semver = require('semver')
const { queryParser } = require('../../db/query-parsers/elasticsearch')

/**
 * Instruments the `@opensearch-project/opensearch` module. This function is
 * passed to `onRequire` when instantiating instrumentation.
 *
 * @param {object} _agent New Relic agent
 * @param {object} opensearch resolved module
 * @param {string} _moduleName string representation of require/import path
 * @param {object} shim New Relic shim
 * @returns {void}
 */
module.exports = function initialize(_agent, opensearch, _moduleName, shim) {
  const pkgVersion = shim.pkgVersion
  if (semver.lt(pkgVersion, '2.1.0')) {
    shim &&
      shim.logger.debug(
        `Opensearch support is for versions 2.1.0 and above. Not instrumenting ${pkgVersion}.`
      )
    return
  }

  shim.setDatastore(shim.OPENSEARCH)
  shim.setParser(queryParser)

  shim.recordQuery(
    opensearch.Transport.prototype,
    'request',
    function wrapQuery(shim, _, __, args) {
      const ctx = this
      return new QuerySpec({
        query: JSON.stringify(args?.[0]),
        promise: true,
        opaque: true,
        inContext: function inContext() {
          getConnection.call(ctx, shim)
        }
      })
    }
  )
}

/**
 * Convenience function for deriving connection information from
 * opensearch
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
