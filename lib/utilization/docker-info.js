/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'docker-info' })
const common = require('./common')
const NAMES = require('../metrics/names')
const os = require('os')
let vendorInfo = null

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
    const asciiData = Buffer.from(data, 'ascii').toString()

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
    agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.BOOT_ID_ERROR).incrementCallCount()
  }
}

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

    let id = null
    findCGroups(data, 'cpu', function forEachCpuGroup(cpuGroup) {
      const match = /(?:^|[^0-9a-f])([0-9a-f]{64})(?:[^0-9a-f]|$)/.exec(cpuGroup)
      if (match) {
        id = match[1]
        return false
      }

      return true
    })

    if (id) {
      vendorInfo = { id: id }
      callback(null, vendorInfo)
    } else {
      logger.debug('No matching cpu group found.')
      callback(null, null)
    }
  })
}

function findCGroups(info, cgroup, eachCb) {
  const target = new RegExp('^\\d+:[^:]*?\\b' + cgroup + '\\b[^:]*:')
  const lines = info.split('\n')
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i]
    if (target.test(line) && !eachCb(line.split(':')[2])) {
      break
    }
  }
}
