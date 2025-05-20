/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const gcpMetadata = require('gcp-metadata')
const logger = require('../logger.js').child({ component: 'gcp-info' })
const common = require('./common')
const NAMES = require('../metrics/names.js')
const JSONbig = require('json-bigint')({ useNativeBigInt: true })
let resultDict = null

module.exports = fetchGCPInfo
module.exports.clearCache = function clearGCPCache() {
  resultDict = null
}


async function fetchGCPInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_gcp) {
    logger.trace({ utilization: 'gcp' }, 'Skipping GCP due to being disabled via config.')
    return setImmediate(callback, null)
  }

  if (resultDict) {
    logger.trace({ utilization: 'gcp' }, 'Returning previously found results.')
    return setImmediate(callback, null, resultDict)
  }

  const isAvail = await gcpMetadata.isAvailable()
  if (isAvail) {
    console.debug('hostname: ', await gcpMetadata.instance('hostname'))
    console.debug('instanceId: ', await gcpMetadata.instance('id'))
  }

  common.request(
    {
      host: 'metadata.google.internal',
      path: '/computeMetadata/v1/instance/?recursive=true',
      headers: {
        'Metadata-Flavor': 'Google'
      }
    },
    agent,
    function getMetadata(err, data) {
      if (err) {
        logger.trace({ utilization: 'gcp', error: err }, 'Failed to communicate with metadata endpoint.')
        return callback(err)
      }
      try {
        console.debug('metadata before parse: ', data)
        data = JSONbig.parse(data)
        if (typeof data.id !== 'string') {
          data.id = data.id.toString()
        }
      } catch (e) {
        logger.debug({ utilization: 'gcp', error: e }, 'Failed to parse GCP metadata.')
        data = null
      }

      // Pull out the id, zone, zone, and machineType from the metadata
      const results = common.getKeys(data, ['id', 'zone'])
      if (results == null) {
        logger.debug({ utilization: 'gcp' }, 'GCP metadata was invalid.')
        agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.GCP_ERROR).incrementCallCount()
      } else {
        if (data.machineType) {
          results.machineType = data.machineType
          // normalize
          results.machineType = results.machineType.substring(
            results.machineType.lastIndexOf('/') + 1
          )
        }
        results.zone = results.zone.substring(results.zone.lastIndexOf('/') + 1)

        resultDict = results
      }
      callback(null, results)
    }
  )
}
