/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function fetchEcsInfo(
  agent,
  callback,
  {
    logger = require('../logger').child({ component: 'ecs-info' }),
    getEcsContainerId = require('./docker-info').getEcsContainerId
  } = {}
) {
  // Per spec, we do not have a `detect_ecs` key. Since ECS is a service of AWS,
  // we rely on the `detect_aws` setting.
  if (!agent.config.utilization || !agent.config.utilization.detect_aws) {
    return setImmediate(callback, null)
  }

  getEcsContainerId({
    agent,
    logger,
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
