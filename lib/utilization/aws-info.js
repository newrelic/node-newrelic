'use strict'

var logger = require('../logger.js').child({component: 'aws-info'})
var common = require('./common')
var NAMES = require('../metrics/names.js')

module.exports = fetchAWSInfo
module.exports.clearCache = function clearAWSCache() {
  results = null
}

var results = null

function fetchAWSInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_aws) {
    return setImmediate(callback, null)
  }

  if (results) {
    return setImmediate(callback, null, results)
  }

  var instanceHost = '169.254.169.254'
  var apiVersion = '2016-09-02'
  var endpoint = 'dynamic/instance-identity/document'
  var url = 'http://' + instanceHost + '/' + apiVersion + '/' + endpoint
  common.request(url, agent, function getMetadata(err, data) {
    if (err) {
      return callback(err)
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
}
