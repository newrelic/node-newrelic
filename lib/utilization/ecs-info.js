/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const http = require('node:http')
const NAMES = require('../metrics/names')

module.exports = function fetchEcsInfo(
  agent,
  callback,
  {
    logger = require('../logger').child({ component: 'ecs-info' }),
    getEcsContainerId = _getEcsContainerId,
    hasAwsContainerApi = _hasAwsContainerApi,
    recordIdError = _recordIdError
  } = {}
) {
  // Per spec, we do not have a `detect_ecs` key. Since ECS is a service of AWS,
  // we rely on the `detect_aws` setting.
  if (!agent.config.utilization || !agent.config.utilization.detect_aws) {
    return setImmediate(callback, null)
  }

  if (hasAwsContainerApi() === false) {
    logger.debug('ECS API not available, omitting ECS container id info')
    recordIdError(agent)
    return callback(null, null)
  }

  getEcsContainerId({
    agent,
    logger,
    recordIdError,
    callback: (error, dockerId) => {
      if (error) {
        return callback(error, null)
      }
      if (dockerId === null) {
        // Some error happened where we could not find the id. Skipping.
        return callback(null, null)
      }
      return callback(null, { ecsDockerId: dockerId })
    }
  })
}

/**
 * Queries the AWS ECS metadata API to get the boot id.
 *
 * @param {object} params Function parameters.
 * @param {object} params.agent Newrelic agent instance.
 * @param {Function} params.callback Typical error first callback. The second
 * parameter is the boot id as a string.
 * @param {object} params.logger Internal logger instance.
 * @param {function} params.recordIdError Function to record error metric.
 */
function _getEcsContainerId({ agent, callback, logger, recordIdError }) {
  const ecsApiUrl =
    process.env.ECS_CONTAINER_METADATA_URI_V4 || process.env.ECS_CONTAINER_METADATA_URI
  const req = http.request(ecsApiUrl, (res) => {
    let body = Buffer.alloc(0)
    res.on('data', (chunk) => {
      body = Buffer.concat([body, chunk])
    })
    res.on('end', () => {
      try {
        const json = body.toString('utf8')
        const data = JSON.parse(json)
        if (data.DockerId == null) {
          logger.debug('Failed to find DockerId in response, omitting boot info')
          recordIdError(agent)
          return callback(null, null)
        }
        callback(null, data.DockerId)
      } catch (error) {
        logger.debug('Failed to process ECS API response, omitting boot info: ' + error.message)
        recordIdError(agent)
        callback(null, null)
      }
    })
  })

  req.on('error', () => {
    logger.debug('Failed to query ECS endpoint, omitting boot info')
    recordIdError(agent)
    callback(null, null)
  })

  req.end()
}

/**
 * Inspects the running environment to determine if the AWS ECS metadata API
 * is available.
 *
 * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ec2-metadata.html
 *
 * @returns {boolean}
 */
function _hasAwsContainerApi() {
  if (process.env.ECS_CONTAINER_METADATA_URI_V4 != null) {
    return true
  }
  return process.env.ECS_CONTAINER_METADATA_URI != null
}

function _recordIdError(agent) {
  agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.ECS_CONTAINER_ERROR).incrementCallCount()
}
