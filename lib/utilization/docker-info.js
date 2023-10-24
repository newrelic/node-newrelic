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
const CGROUPS_V1_PATH = '/proc/self/cgroup'
const CGROUPS_V2_PATH = '/proc/self/mountinfo'

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

/**
 * Attempt to extract container id from either cgroups v1 or v2 file
 *
 * @param {object} agent NR instance
 * @param {Function} callback function to call when done
 */
function fetchDockerVendorInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_docker) {
    return callback(null, null)
  }

  if (vendorInfo) {
    return callback(null, vendorInfo)
  }

  if (!os.platform().match(/linux/i)) {
    logger.debug('Platform is not a flavor of linux, omitting docker info')
    return callback(null, null)
  }

  // try v2 path first and if null try parsing v1 path
  common.readProc(CGROUPS_V2_PATH, function getV2CGroup(err, data) {
    if (data === null) {
      logger.debug(
        `${CGROUPS_V2_PATH} not found, trying to parse container id from ${CGROUPS_V1_PATH}`
      )
      findCGroupsV1(callback)
      return
    }

    parseCGroupsV2(data, callback)
  })
}

/**
 * Try extracting container id from a /proc/self/mountinfo
 * e.g. - `528 519 254:1 /docker/containers/84cf3472a20d1bfb4b50e48b6ff50d96dfcd812652d76dd907951e6f98997bce/resolv.conf`
 *
 * @param {string} data file contents
 * @param {Function} callback function to call when done
 */
function parseCGroupsV2(data, callback) {
  const containerLine = new RegExp('/docker/containers/([0-9a-f]{64})/')
  const line = containerLine.exec(data)
  if (line) {
    callback(null, { id: line[1] })
  } else {
    logger.debug(`Found ${CGROUPS_V2_PATH} but failed to parse Docker container id.`)
    callback(null, null)
  }
}

/**
 * Read /proc/self/cgroup and try to extract the container id from a cpu line
 * e.g. - `4:cpu:/docker/f37a7e4d17017e7bf774656b19ca4360c6cdc4951c86700a464101d0d9ce97ee`
 *
 * @param {Function} callback function to call when done
 */
function findCGroupsV1(callback) {
  common.readProc(CGROUPS_V1_PATH, function getCGroup(err, data) {
    if (!data) {
      logger.debug(`${CGROUPS_V1_PATH} not found, exiting parsing containerId.`)
      return callback(null)
    }

    let id = null
    parseCGroupsV1(data, 'cpu', function forEachCpuGroup(cpuGroup) {
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

/**
 * Iterate line by line to extract the container id from the cpu stanza
 *
 * @param {string} info contents of file
 * @param {string} cgroup value is cpu
 * @param {Function} eachCb funtion to test if the container id exists
 */
function parseCGroupsV1(info, cgroup, eachCb) {
  const target = new RegExp('^\\d+:[^:]*?\\b' + cgroup + '\\b[^:]*:')
  const lines = info.split('\n')
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i]
    if (target.test(line) && !eachCb(line.split(':')[2])) {
      break
    }
  }
}
