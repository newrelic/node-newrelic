/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { OperationSpec } = require('../../../shim/specs')
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')
const {
  params: { DatastoreParameters }
} = require('../../../shim/specs')
const UNKNOWN = 'Unknown'

function getRedshiftSpec(shim, original, name, args) {
  const [{ input }] = args
  return new OperationSpec({
    name: this.commandName,
    parameters: setRedshiftParameters(this.endpoint, input),
    callback: shim.LAST,
    opaque: true,
    promise: true
  })
}

async function getEndpoint(config) {
  if (typeof config.endpoint === 'function') {
    return await config.endpoint()
  }

  const region = await config.region()
  return new URL(`https://redshift-data.${region}.amazonaws.com`)
}

function redshiftMiddleware(shim, config, next, context) {
  const { commandName } = context
  return async function wrappedMiddleware(args) {
    let endpoint = null
    try {
      endpoint = await getEndpoint(config)
    } catch (err) {
      shim.logger.debug(err, 'Failed to get the endpoint.')
    }

    const getSpec = getRedshiftSpec.bind({ endpoint, commandName })
    const wrappedNext = shim.recordOperation(next, getSpec)
    return wrappedNext(args)
  }
}

function setRedshiftParameters(endpoint, params) {
  return new DatastoreParameters({
    host: endpoint && (endpoint.host || endpoint.hostname),
    port_path_or_id: (endpoint && endpoint.port) || 443,
    collection: (params && params.ClusterIdentifier) || UNKNOWN,
    database_name: (params && params.Database) || UNKNOWN
  })
}

const redshiftMiddlewareConfig = [
  {
    middleware: redshiftMiddleware,
    init(shim) {
      shim.setDatastore(shim.REDSHIFT)
      return true
    },
    type: InstrumentationDescriptor.TYPE_DATASTORE,
    config: {
      name: 'NewRelicRedshiftMiddleware',
      step: 'initialize',
      priority: 'high',
      override: true
    }
  }
]

module.exports = {
  redshiftMiddlewareConfig
}
