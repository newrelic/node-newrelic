'use strict'

var logger = require('../logger.js').child({component: 'pcf-info'})
var NAMES = require('../metrics/names.js')
var common = require('./common')

module.exports = fetchPCFInfo

function fetchPCFInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_pcf) {
    return setImmediate(callback, null, null)
  }

  var metadataMap = {
    'CF_INSTANCE_GUID': 'cf_instance_guid',
    'CF_INSTANCE_IP': 'cf_instance_ip',
    'MEMORY_LIMIT': 'memory_limit'
  }

  var results = {}
  var keys = Object.keys(metadataMap)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    var value = process.env[key]
    if (!common.checkValueString(value)) {
      logger.trace('Could not find environment value for ' + key)
      agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.PCF_ERROR).incrementCallCount()
      return setImmediate(callback, null, null)
    }
    results[metadataMap[key]] = value
  } 

  setImmediate(callback, null, results)
}
