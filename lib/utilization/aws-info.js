/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger.js').child({ component: 'aws-info' })
const common = require('./common')
const NAMES = require('../metrics/names.js')
let results = null
const INSTANCE_HOST = '169.254.169.254'

module.exports = fetchAWSInfo
module.exports.clearCache = function clearAWSCache() {
  results = null
}

function fetchAWSInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_aws) {
    return setImmediate(callback, null)
  }

  if (results) {
    return setImmediate(callback, null, results)
  }

  const authTokenOpts = {
    headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
    host: INSTANCE_HOST,
    method: 'PUT',
    path: '/latest/api/token',
    timeout: 500
  }
  common.request(authTokenOpts, agent, function getAuthToken(err, authToken) {
    if (err) {
      logger.debug('Failed to get AWS auth token.')
      return callback(err)
    }

    const metadataOpts = {
      headers: { 'X-aws-ec2-metadata-token': authToken },
      host: INSTANCE_HOST,
      method: 'GET',
      path: '/latest/dynamic/instance-identity/document',
      timeout: 500
    }

    common.request(metadataOpts, agent, function getMetadata(metaErr, data) {
      if (metaErr) {
        return callback(metaErr)
      }

      try {
        data = JSON.parse(data)
      } catch (e) {
        logger.debug(e, 'Failed to parse AWS metadata.')
        data = null
      }

      results = common.getKeys(data, ['availabilityZone', 'instanceId', 'instanceType'])
      if (results == null) {
        logger.debug('AWS metadata was invalid.')
        agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.AWS_ERROR).incrementCallCount()
      }
      callback(null, results)
    })
  })
}
