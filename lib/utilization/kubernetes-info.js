'use strict'
const logger = require('../logger').child({component: 'kubernetes-info'})

let info = null

module.exports = getKubernetesInfo
module.exports.clearCache = function clearAWSCache() {
  info = null
}

function getKubernetesInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_kubernetes) {
    return setImmediate(callback, null, null)
  }

  if (info) {
    return setImmediate(callback, null, info)
  }

  if (!process.env.KUBERNETES_SERVICE_HOST) {
    logger.debug('No Kubernetes service host found.')
    return setImmediate(callback, null, null)
  }

  info = {kubernetes_service_host: process.env.KUBERNETES_SERVICE_HOST}

  setImmediate(callback, null, info)
}
