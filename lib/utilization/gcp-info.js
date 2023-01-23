/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger.js').child({ component: 'gcp-info' })
const common = require('./common')
const NAMES = require('../metrics/names.js')
const JSONbig = require('json-bigint')({ useNativeBigInt: true })
let resultDict = null

module.exports = fetchGCPInfo
module.exports.clearCache = function clearGCPCache() {
  resultDict = null
}

function fetchGCPInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_gcp) {
    return setImmediate(callback, null)
  }

  if (resultDict) {
    return setImmediate(callback, null, resultDict)
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
        return callback(err)
      }
      try {
        data = JSONbig.parse(data)
        if (typeof data.id !== 'string') {
          data.id = data.id.toString()
        }
      } catch (e) {
        logger.debug(e, 'Failed to parse GCP metadata.')
        data = null
      }

      const results = common.getKeys(data, ['id', 'machineType', 'name', 'zone'])
      if (results == null) {
        logger.debug('GCP metadata was invalid.')
        agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.GCP_ERROR).incrementCallCount()
      } else {
        // normalize
        results.machineType = results.machineType.substr(results.machineType.lastIndexOf('/') + 1)
        results.zone = results.zone.substr(results.zone.lastIndexOf('/') + 1)

        resultDict = results
      }
      callback(null, results)
    }
  )
}
