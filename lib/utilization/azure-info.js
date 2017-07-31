'use strict'

var common = require('./common')
var logger = require('../logger.js').child({component: 'azure-info'})
var NAMES = require('../metrics/names.js')


module.exports = fetchAzureInfo
module.exports.clearCache = function clearAzureCache() {
  results = null
}

var results = null

function fetchAzureInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_azure) {
    return setImmediate(callback, null, null)
  }

  if (results) {
    return setImmediate(callback, null, results)
  }

  var instanceHost = '169.254.169.254'
  var apiVersion = '2017-03-01'
  var endpoint = '/metadata/instance/compute'
  common.request({
    host: instanceHost,
    path: endpoint + '?api-version=' + apiVersion,
    headers: {Metadata: 'true'}
  }, agent, function getMetadata(err, data) {
    if (err) {
      return callback(err)
    }

    // Hopefully the data is parsable as JSON.
    try {
      data = JSON.parse(data)
    } catch (e) {
      logger.debug(e, 'Failed to parse Azure metadata.')
      data = null
    }

    // Get out just the keys we care about.
    results = common.getKeys(data, ['location', 'name', 'vmId', 'vmSize'])
    if (results == null) {
      logger.debug('Azure metadata was invalid.')
      agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.AZURE_ERROR).incrementCallCount()
    }

    // Call back!
    callback(null, results)
  })
}
