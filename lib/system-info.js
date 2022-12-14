/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')
const execFile = util.promisify(require('child_process').execFile)
const readProc = util.promisify(require('./utilization/common').readProc)
const getBootId = util.promisify(require('./utilization/docker-info').getBootId)
const getVendors = util.promisify(require('./utilization').getVendors)
const logger = require('./logger.js').child({ component: 'system-info' })
const os = require('os')
const parseCpuInfo = require('./parse-proc-cpuinfo')
const parseMemInfo = require('./parse-proc-meminfo')
const Agent = require('./agent')
const platform = os.platform()

module.exports = fetchSystemInfo

/**
 * Helper method for determining if given value can be an integer
 *
 * @param {*} value the value to check
 * @returns {boolean} whether or not the value can be coerced to an integer
 */
function isInteger(value) {
  return value === parseInt(value, 10)
}

/**
 * Helper method for updating the utilization info with processor information from the config
 *
 * @param {*} processorConfig agent.config.utilization.logical_processors
 * @param {object} utilizationConfig Utilization configuration object defined in #fetchSystemInfo
 */
function maybeAddProcessorUtilization(processorConfig, utilizationConfig) {
  const parsedConfigProcessors = parseFloat(processorConfig, 10)
  if (!isNaN(parsedConfigProcessors) && isInteger(parsedConfigProcessors)) {
    utilizationConfig.logical_processors = parsedConfigProcessors
  } else {
    logger.info(
      '%s supplied in config for utilization.logical_processors, expected a number',
      processorConfig
    )
  }
}

/**
 * Helper method for updating the utilization info with RAM information from the config
 *
 * @param {*} ramConfig agent.config.utilization.total_ram_mib
 * @param {object} utilizationConfig Utilization configuration object defined in #fetchSystemInfo
 */
function maybeAddRamUtilization(ramConfig, utilizationConfig) {
  const parsedConfigRam = parseFloat(ramConfig, 10)
  if (!isNaN(parsedConfigRam) && isInteger(parsedConfigRam)) {
    utilizationConfig.total_ram_mib = parsedConfigRam
  } else {
    logger.info('%s supplied in config for utilization.total_ram_mib, expected a number', ramConfig)
  }
}

/**
 * Helper method for updating the utilization info with hostname information from the config
 *
 * @param {*} configHostname agent.config.utilization.billing_hostname
 * @param {object} utilizationConfig Utilization configuration object defined in #fetchSystemInfo
 */
function maybeAddHostUtilization(configHostname, utilizationConfig) {
  if (typeof configHostname === 'string') {
    utilizationConfig.hostname = configHostname
  } else {
    logger.info('%s supplied in config for utilization.Hostname, expected a string', configHostname)
  }
}

/**
 * Helper method for updating the system info with architecture dependent processor info
 *
 * @param {*} processorStats output of #getProcessorStats
 * @param {object} systemInfo System Information object defined in #fetchSystemInfo
 */
function maybeSetProcessorStats(processorStats, systemInfo) {
  if (processorStats) {
    systemInfo.packages = processorStats.packages
    systemInfo.logicalProcessors = processorStats.logical
    systemInfo.cores = processorStats.cores
  }
}

/**
 * Helper method for updating the system info with architecture dependent RAM info
 *
 * @param {*} memoryStats output of #getMemoryStats
 * @param {object} systemInfo System Information object defined in #fetchSystemInfo
 */
function maybeSetMemoryStats(memoryStats, systemInfo) {
  if (memoryStats) {
    systemInfo.memory = memoryStats
  }
}

/**
 * Helper method for updating the system info with architecture dependent Kernel info
 *
 * @param {*} kernelStats output of #getKernelVersion
 * @param {object} systemInfo System Information object defined in #fetchSystemInfo
 */
function maybeSetKernelStats(kernelStats, systemInfo) {
  if (kernelStats) {
    systemInfo.kernelVersion = kernelStats
  }
}

/**
 * Helper method for updating the system info with vendor info
 *
 * @param {*} vendorStats output of #utilization.getVendors
 * @param {object} systemInfo System Information object defined in #fetchSystemInfo
 */
function maybeSetVendorStats(vendorStats, systemInfo) {
  if (vendorStats) {
    systemInfo.vendors = vendorStats
  }
}

/**
 * Helper method for updating the system info with the Docker boot id
 *
 * @param {*} bootId output of #utilization/docker-info.getBootId
 * @param {object} systemInfo System Information object defined in #fetchSystemInfo
 */
function maybeSetBootId(bootId, systemInfo) {
  if (bootId) {
    systemInfo.bootId = bootId
  }
}

/**
 * Main method for retrieving system level statistics, used for fact gathering on Agent startup
 *
 * @param {Agent} agent Instantiation of Node.js agent
 * @param {Function} callback Callback to fire after we've gathered all the necessary stats
 */
async function fetchSystemInfo(agent, callback) {
  const utilizationConfig = Object.create(null)
  const systemInfo = {
    processorArch: os.arch()
  }

  const processorConfig = agent.config.utilization?.logical_processors
  if (processorConfig) {
    maybeAddProcessorUtilization(processorConfig, utilizationConfig)
  }

  const ramConfig = agent.config.utilization?.total_ram_mib
  if (ramConfig) {
    maybeAddRamUtilization(ramConfig, utilizationConfig)
  }

  const configHostname = agent.config.utilization?.billing_hostname
  if (configHostname) {
    maybeAddHostUtilization(configHostname, utilizationConfig)
  }

  if (Object.keys(utilizationConfig).length > 0) {
    systemInfo.config = utilizationConfig
  }

  const processorStats = await module.exports._getProcessorStats()
  const memoryStats = await module.exports._getMemoryStats()
  const kernelStats = await getKernelVersion()
  const vendorStats = await getVendors(agent)
  const bootId = await getBootId(agent)

  maybeSetProcessorStats(processorStats, systemInfo)
  maybeSetMemoryStats(memoryStats, systemInfo)
  maybeSetKernelStats(kernelStats, systemInfo)
  maybeSetVendorStats(vendorStats, systemInfo)
  maybeSetBootId(bootId, systemInfo)

  callback(null, systemInfo)
}

/**
 * Helper method for getting detailed, architecture specific processor information from the system
 * Exported for testing purposes
 *
 * @returns {*} null if unknown platform, otherwise the processor stats
 */
module.exports._getProcessorStats = async function getProcessorStats() {
  const processorStats = {
    logical: null,
    cores: null,
    packages: null
  }

  if (platform.match(/darwin/i)) {
    const packages = await getSysctlValue(['hw.packages'])
    const cores = await getSysctlValue(['hw.physicalcpu_max', 'hw.physicalcpu'])
    const logical = await getSysctlValue(['hw.logicalcpu_max', 'hw.logicalcpu', 'hw.ncpu'])

    processorStats.logical = isInteger(logical) ? parseFloat(logical, 10) : null
    processorStats.cores = isInteger(cores) ? parseFloat(cores, 10) : null
    processorStats.packages = isInteger(packages) ? parseFloat(packages, 10) : null

    return processorStats
  } else if (platform.match(/bsd/i)) {
    const logical = await getSysctlValue(['hw.ncpu'])

    processorStats.logical = logical

    return processorStats
  } else if (platform.match(/linux/i)) {
    const data = await getProcInfo('/proc/cpuinfo')

    return parseCpuInfo(data)
  }

  logger.debug('Unknown platform: %s; could not retrieve processor info', platform)
  return processorStats
}

/**
 * Helper method for getting detailed, architecture specific RAM information from the system
 * Exported for testing purposes
 *
 * @returns {*} null if unknown platform, otherwise the RAM amount
 */
module.exports._getMemoryStats = async function getMemoryStats() {
  if (platform.match(/darwin/i)) {
    const memory = await getSysctlValue(['hw.memsize'])
    return parseInt(memory, 10) / (1024 * 1024)
  } else if (platform.match(/bsd/i)) {
    const memory = await getSysctlValue(['hw.realmem'])
    return parseInt(memory, 10) / (1024 * 1024)
  } else if (platform.match(/linux/i)) {
    const data = await getProcInfo('/proc/meminfo')
    return parseMemInfo(data)
  }

  logger.debug('Unknown platform: %s; could not retrieve memory info', platform)
  return null
}

/**
 * Helper method for retrieving Kernel version information for different platforms
 *
 * @returns {*} null if unknown platform, otherwise string representation of kernel version
 */
async function getKernelVersion() {
  if (platform.match(/darwin/i) || platform.match(/bsd/i)) {
    return await getSysctlValue(['kern.version'])
  } else if (platform.match(/linux/i)) {
    return await getProcInfo('/proc/version')
  }

  logger.debug('Unknown platform: %s; could not read kernel version', platform)
  return null
}

/**
 * Helper method for getting sysctl information given a list of potential values to look up
 * Returns the first successful sysctl's output
 *
 * @param {Array.<string>} names List of sysctl values to look up
 * @returns {*} null if we failed to lookup any info (error or not), or the first successful sysctl's output
 */
async function getSysctlValue(names = []) {
  let returnValue = null

  for (const name of names) {
    // returnValue being set means we already found what we were looking for, early exit for performance
    if (returnValue) {
      break
    }

    try {
      const { stderr, stdout } = await execFile('sysctl', ['-n', name])

      if (!stderr) {
        returnValue = stdout
      }
    } catch (err) {
      logger.debug('Error when trying to run: sysctl -n %s: %s', name, err.message)
    }
  }

  if (returnValue === null) {
    logger.debug('No sysctl info found for names: %j', names)
  }

  return returnValue
}

/**
 * Helper method for getting /proc/* file information in Linux environments
 *
 * @param {string} procPath - the proc file to read
 * @returns {*} null if the lookup fails, otherwise the proc file information
 */
async function getProcInfo(procPath) {
  try {
    return await readProc(procPath)
  } catch (err) {
    // swallow the error if reading fails, logging handled in readProc()
    return null
  }
}
