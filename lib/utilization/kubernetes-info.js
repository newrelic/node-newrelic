/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../logger').child({ component: 'kubernetes-info' })

let info = null

module.exports = getKubernetesInfo
module.exports.clearCache = function clearKubernetesCache() {
  info = null
}

function getKubernetesInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_kubernetes) {
    logger.trace({ utilization: 'kubernetes' }, 'Skipping Kubernetes due to being disabled via config.')
    return setImmediate(callback, null, null)
  }

  if (info) {
    logger.trace({ utilization: 'kubernetes' }, 'Returning previously found results.')
    return setImmediate(callback, null, info)
  }

  if (!process.env.KUBERNETES_SERVICE_HOST) {
    logger.debug({ utilization: 'kubernetes' }, 'No Kubernetes service host found.')
    return setImmediate(callback, null, null)
  }

  info = { kubernetes_service_host: process.env.KUBERNETES_SERVICE_HOST }

  setImmediate(callback, null, info)
}
