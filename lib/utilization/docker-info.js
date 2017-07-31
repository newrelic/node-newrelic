'use strict'

var logger = require('../logger.js').child({component: 'dockerinfo'})
var common = require('./common')
var NAMES = require('../metrics/names.js')
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

    var cpuCgroup = parseCgroupIds(data).cpu
    // if we can't parse the cgroups, or if the cpu is not in a cgroup
    var dockerError = agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.DOCKER_ERROR)
    if (!cpuCgroup) {
      logger.debug('Could not parse cgroup data from: ' + data)
      dockerError.incrementCallCount()
      return callback(null)
    }

    // if cpu isn't in a cgroup
    if (cpuCgroup === '/') {
      return callback(null)
    }

    var patterns = [
      /^\/docker\/([0-9a-f]+)$/, // docker native driver w/out systemd
      /^\/system\.slice\/docker-([0-9a-f]+)\.scope$/, // with systemd
      /^\/lxc\/([0-9a-f]+)$/ // docker lxc driver
    ]
    for (var i = 0; i < patterns.length; i++) {
      var pattern = patterns[i]
      var matches = cpuCgroup.match(pattern)
      if (matches) {
        var id = matches[1]
        if (id.length !== 64) {
          dockerError.incrementCallCount()
          logger.debug('Encountered a malformed docker id: ', id)
          break
        }
        vendorInfo = vendorInfo || {}
        vendorInfo.id = id
        break
      }
    }
    if (!vendorInfo) {
      logger.debug('Unable to recognise cgroup format')
    }
    return callback(null, vendorInfo)
  })
}

function parseCgroupIds(cgroupInfo) {
  var cgroupIds = {}
  cgroupInfo.split('\n').forEach(function parseCgroupInfo(line) {
    var parts = line.split(':')
    if (parts.length !== 3) return
    var subsystems = parts[1]
    var cgroupId = parts[2]
    subsystems.split(',').forEach(function assignGroupIds(subsystem) {
      cgroupIds[subsystem] = cgroupId
    })
  })
  return cgroupIds
}
