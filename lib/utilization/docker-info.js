/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('node:fs')
const log = require('../logger').child({ component: 'docker-info' })
const common = require('./common')
const NAMES = require('../metrics/names')
const os = require('os')
let vendorInfo = null

const CGROUPS_V1_PATH = '/proc/self/cgroup'
const CGROUPS_V2_PATH = '/proc/self/mountinfo'
const BOOT_ID_PROC_FILE = '/proc/sys/kernel/random/boot_id'

module.exports = {
  clearVendorCache: clearDockerVendorCache,
  getBootId,
  getVendorInfo: fetchDockerVendorInfo
}

function clearDockerVendorCache() {
  vendorInfo = null
}

function getBootId(agent, callback, logger = log) {
  if (!/linux/i.test(os.platform())) {
    logger.debug({ utilization: 'docker' }, 'Platform is not a flavor of linux, omitting boot info')
    return setImmediate(callback, null, null)
  }

  fs.access(BOOT_ID_PROC_FILE, fs.constants.F_OK, (err) => {
    if (err == null) {
      // The boot id proc file exists, so use it to get the container id.
      return common.readProc(BOOT_ID_PROC_FILE, (_, data, cbAgent = agent) => {
        readProcBootId({ data, agent: cbAgent, callback })
      })
    }

    logger.debug({ utilization: 'docker' }, 'Container boot id is not available in cgroups info')
    callback(null, null)
  })
}

/**
 * Increments a supportability metric to indicate that there was an error
 * while trying to read the boot id from the system.
 *
 * @param {object} agent Newrelic agent instance.
 */
function recordBootIdError(agent) {
  agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.BOOT_ID_ERROR).incrementCallCount()
}

/**
 * Utility function to parse a Docker boot id from a cgroup proc file.
 *
 * @param {object} params params object
 * @param {Buffer} params.data The information from the proc file.
 * @param {Agent} params.agent Newrelic agent instance.
 * @param {Function} params.callback Typical error first callback. Second parameter
 * is the boot id as a string.
 *
 * @returns {*}
 */
function readProcBootId({ data, agent, callback }) {
  if (!data) {
    recordBootIdError(agent)
    return callback(null, null)
  }

  data = data.trim()
  const asciiData = Buffer.from(data, 'ascii').toString()

  if (data !== asciiData) {
    recordBootIdError(agent)
    return callback(null, null)
  }

  if (data.length !== 36) {
    recordBootIdError(agent)
    if (data.length > 128) {
      data = data.substring(0, 128)
    }
  }

  return callback(null, data)
}

/**
 * Attempt to extract container id from either cgroups v1 or v2 file
 *
 * @param {object} agent NR instance
 * @param {Function} callback function to call when done
 * @param {object} [logger] internal logger instance
 */
function fetchDockerVendorInfo(agent, callback, logger = log) {
  if (!agent.config.utilization || !agent.config.utilization.detect_docker) {
    logger.trace({ utilization: 'docker' }, 'Skipping Docker due to being disabled via config.')
    return callback(null, null)
  }

  if (vendorInfo) {
    return callback(null, vendorInfo)
  }

  if (!os.platform().match(/linux/i)) {
    logger.debug({ utilization: 'docker' }, 'Platform is not a flavor of linux, omitting docker info')
    return callback(null, null)
  }

  // try v2 path first and if null try parsing v1 path
  common.readProc(CGROUPS_V2_PATH, function getV2CGroup(_, data) {
    if (data === null) {
      logger.debug(
        { utilization: 'docker' },
        `${CGROUPS_V2_PATH} not found, trying to parse container id from ${CGROUPS_V1_PATH}`
      )
      findCGroupsV1(callback, logger)
      return
    }

    parseCGroupsV2(
      data,
      (_, v2Data) => {
        if (v2Data !== null) {
          // We found a valid Docker identifier in the v2 file, so we are going
          // to prioritize it.
          logger.debug({ utilization: 'docker', v2Data }, 'Found identifier in cgroups v2 file.')
          return callback(null, v2Data)
        }

        // For some reason, we have a /proc/self/mountinfo but it does not have
        // any Docker information in it (that we have detected). So we will
        // fall back to trying the cgroups v1 file.
        logger.debug({ utilization: 'docker' }, 'Attempting to fall back to cgroups v1 parsing.')
        findCGroupsV1(callback, logger)
      },
      logger
    )
  })
}

/**
 * Try extracting container id from a /proc/self/mountinfo
 * e.g. - `528 519 254:1 /docker/containers/84cf3472a20d1bfb4b50e48b6ff50d96dfcd812652d76dd907951e6f98997bce/resolv.conf`
 *
 * @param {string} data file contents
 * @param {Function} callback function to call when done
 * @param {object} [logger] internal logger instance
 */
function parseCGroupsV2(data, callback, logger = log) {
  const containerLine = /\/docker\/containers\/([0-9a-f]{64})\//
  const line = containerLine.exec(data)
  if (line) {
    logger.debug({ utilization: 'docker' }, `Found docker id from cgroups v2: ${line[1]}`)
    callback(null, { id: line[1] })
  } else {
    logger.debug({ utilization: 'docker' }, `Found ${CGROUPS_V2_PATH} but failed to parse Docker container id.`)
    callback(null, null)
  }
}

/**
 * Read /proc/self/cgroup and try to extract the container id from a cpu line
 * e.g. - `4:cpu:/docker/f37a7e4d17017e7bf774656b19ca4360c6cdc4951c86700a464101d0d9ce97ee`
 *
 * @param {Function} callback function to call when done
 * @param {object} [logger] internal logger instance
 */
function findCGroupsV1(callback, logger = log) {
  common.readProc(CGROUPS_V1_PATH, function getCGroup(_, data) {
    if (!data) {
      logger.debug({ utilization: 'docker' }, `${CGROUPS_V1_PATH} not found, exiting parsing containerId.`)
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
      vendorInfo = { id }
      logger.debug({ utilization: 'docker' }, `Found docker id from cgroups v1: ${id}`)
      callback(null, vendorInfo)
    } else {
      logger.debug({ utilization: 'docker' }, 'No matching cpu group found.')
      callback(null, null)
    }
  })
}

/**
 * Iterate line by line to extract the container id from the cpu stanza
 *
 * @param {string} info contents of file
 * @param {string} cgroup value is cpu
 * @param {Function} eachCb function to test if the container id exists
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
