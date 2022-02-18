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
    method: 'PUT',
    host: INSTANCE_HOST,
    path: '/latest/api/token',
    headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
  }
  common.request(authTokenOpts, agent, function getAuthToken(err, authToken) {
    if (err) {
      logger.debug('Failed to get AWS auth token.')
      return callback(err)
    }

    const metadataOpts = {
      method: 'GET',
      host: INSTANCE_HOST,
      path: '/2016-09-02/dynamic/instance-identity/document',
      headers: { 'X-aws-ec2-metadata-token': authToken }
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
