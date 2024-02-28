/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const UNKNOWN = 'Unknown'
const DESTINATIONS = {
  TRANS_EVENT: 0x01,

  // This magic number is brought to you by:
  // https://github.com/newrelic/node-newrelic/blob/10762a7/lib/config/attribute-filter.js#L10-L23
  // We hard code it here because we'd have a cyclic dependency if we tried
  // to import it from `newrelic` (`newrelic` uses this module to provide
  // the AWS instrumentation).
  TRANS_SCOPE: 0x01 | 0x02 | 0x04 | 0x08
}

function grabLastUrlSegment(url = '/') {
  // cast URL as string, and an empty
  // string for null, undefined, NaN etc.
  url = '' + (url || '/')
  const lastSlashIndex = url.lastIndexOf('/')
  return url.substr(lastSlashIndex + 1)
}

/**
 * Retrieves the db segment params from endpoint and command parameters
 *
 * @param {function} DatastoreParameters constructor of `shim.spec.DatastoreParameters`
 * @param {Object} endpoint instance of ddb endpoint
 * @param {Object} params parameters passed to a ddb command
 * @returns {Object}
 */
function setDynamoParameters(DatastoreParameters, endpoint, params) {
  return new DatastoreParameters({
    host: endpoint && (endpoint.host || endpoint.hostname),
    port_path_or_id: (endpoint && endpoint.port) || 443,
    collection: (params && params.TableName) || UNKNOWN
  })
}

module.exports = {
  grabLastUrlSegment,
  setDynamoParameters,
  DESTINATIONS
}
