/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger.js').child({ component: 'gcp-info' })
const common = require('./common')
const NAMES = require('../metrics/names.js')
let resultDict = null

module.exports = fetchGCPInfo
module.exports.clearCache = function clearGCPCache() {
  resultDict = null
}

const enquoteGcpIds = (str) => {
  // If JS receives a very long number, it'll lose precision in being converted to scientific notation
  // This matters for GCP id, which is delivered as an unquoted number
  const regex = /(id|"id"|\\"id\\"):\s?(\d+)/
  const matchId = str.match(regex)
  if (!matchId) {
    return str
  }
  // replacement method depends on how quotes are escaped
  // in a real response they probably aren't, but in local testing they need to be.
  let newStr = str
  if (matchId[1] === `id` || matchId[1] === `"id"`) {
    newStr = str.replace(matchId[2], `"${matchId[2]}"`)
  } else if (matchId[1] === '\\"id\\"') {
    newStr = str.replace(matchId[2], `\\"${matchId[2]}\\"`)
  }
  return newStr
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
      data = enquoteGcpIds(data)
      try {
        data = JSON.parse(data)
        if (typeof data === 'string') {
          // parse again if still a string; primarily for large int test
          data = JSON.parse(data)
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
