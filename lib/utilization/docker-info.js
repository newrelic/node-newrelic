'use strict'

var logger = require('../logger').child({component: 'docker-info'})
var common = require('./common')
var NAMES = require('../metrics/names')
var os = require('os')

module.exports.getVendorInfo = fetchDockerVendorInfo
module.exports.clearVendorCache = function clearDockerVendorCache() {
  vendorInfo = null
}

module.exports.getBootId = function getBootId(agent, callback) {
  if (!/linux/i.test(os.platform())) {
    logger.debug('Platform is not a flavor of linux, omitting boot info')
    return setImmediate(callback, null, null)
  }

  common.readProc('/proc/sys/kernel/random/boot_id', function readProcBootId(err, data) {
    if (!data) {
      bootIdError()
      return callback(null, null)
    }

    data = data.trim()
    var asciiData = (new Buffer(data, 'ascii')).toString()

    if (data !== asciiData) {
      bootIdError()
      return callback(null, null)
    }

    if (data.length !== 36) {
      bootIdError()
      if (data.length > 128) {
        data = data.substr(0, 128)
      }
    }

    return callback(null, data)
  })

  function bootIdError() {
    agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.BOOT_ID_ERROR)
      .incrementCallCount()
  }
}

var vendorInfo = null

function fetchDockerVendorInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_docker) {
    return callback(null, null)
  }

  if (vendorInfo) {
    return callback(null, vendorInfo)
  }

  if (!os.platform().match(/linux/i)) {
    logger.debug('Platform is not a flavor of linux, omitting docker info')
    return callback(null)
  }

  common.readProc('/proc/self/cgroup', function getCGroup(err, data) {
    if (!data) {
      return callback(null)
    }

    var id = null
    findCGroups(data, 'cpu', function forEachCpuGroup(cpuGroup) {
      var match = /(?:^|[^0-9a-f])([0-9a-f]{64})(?:[^0-9a-f]|$)/.exec(cpuGroup)
      if (match) {
        id = match[1]
        return false
      }

      return true
    })

    if (id) {
      vendorInfo = {id: id}
      callback(null, vendorInfo)
    } else {
      logger.debug('No matching cpu group found.')
      callback(null, null)
    }
  })
}

function findCGroups(info, cgroup, eachCb) {
  var target = new RegExp('^\\d+:[^:]*?\\b' + cgroup + '\\b[^:]*:')
  var lines = info.split('\n')
  for (var i = 0; i < lines.length; ++i) {
    var line = lines[i]
    if (target.test(line) && !eachCb(line.split(':')[2])) {
      break
    }
  }
}
