/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const exec = require('child_process').exec
const readProc = require('./utilization/common').readProc
const getBootId = require('./utilization/docker-info').getBootId
const utilization = require('./utilization')
const logger = require('./logger.js').child({ component: 'system-info' })
const os = require('os')
const parseCpuInfo = require('./parse-proc-cpuinfo')
const parseMemInfo = require('./parse-proc-meminfo')
const platform = os.platform()

module.exports = fetchSystemInfo

function isInteger(i) {
  return i === parseInt(i, 10)
}

function fetchSystemInfo(agent, callback, numTasks = 5) {
  const config = agent.config
  const systemInfo = {
    processorArch: os.arch()
  }

  const utilizationConfig = Object.create(null)
  if (config.utilization) {
    const configProcessors = config.utilization.logical_processors
    const configRam = config.utilization.total_ram_mib
    const configHostname = config.utilization.billing_hostname

    if (configProcessors) {
      const parsedConfigProcessors = parseFloat(configProcessors, 10)
      if (!isNaN(parsedConfigProcessors) && isInteger(parsedConfigProcessors)) {
        utilizationConfig.logical_processors = parsedConfigProcessors
      } else {
        logger.info(
          '%s supplied in config for utilization.logical_processors, expected a number',
          configProcessors
        )
      }
    }

    if (configRam) {
      const parsedConfigRam = parseFloat(configRam, 10)
      if (!isNaN(parsedConfigRam) && isInteger(parsedConfigRam)) {
        utilizationConfig.total_ram_mib = parsedConfigRam
      } else {
        logger.info(
          '%s supplied in config for utilization.total_ram_mib, expected a number',
          configRam
        )
      }
    }

    if (configHostname) {
      if (typeof configHostname === 'string') {
        utilizationConfig.hostname = configHostname
      } else {
        logger.info(
          '%s supplied in config for utilization.Hostname, expected a string',
          configHostname
        )
      }
    }

    if (Object.keys(utilizationConfig).length > 0) {
      systemInfo.config = utilizationConfig
    }
  }

  let tasksDone = 0
  function finishedResponse() {
    if (++tasksDone === numTasks) {
      callback(null, systemInfo)
    }
  }

  module.exports._getProcessorStats(function getProcessCB(processorStats) {
    systemInfo.packages = processorStats.packages
    systemInfo.logicalProcessors = processorStats.logical
    systemInfo.cores = processorStats.cores
    finishedResponse()
  })
  module.exports._getMemoryStats(function getMemCB(memory) {
    systemInfo.memory = memory
    finishedResponse()
  })
  getKernelVersion(function getVersionCB(kernelVersion) {
    systemInfo.kernelVersion = kernelVersion
    finishedResponse()
  })
  utilization.getVendors(agent, function getVendorInfo(err, vendors) {
    if (vendors) {
      systemInfo.vendors = vendors
    }
    finishedResponse()
  })
  getBootId(agent, function reportBootId(err, bootId) {
    if (bootId) {
      systemInfo.bootId = bootId
    }
    finishedResponse()
  })
}

// placed on module for mocking purposes in tests
module.exports._getProcessorStats = function getProcessorStats(callback) {
  const processorStats = {
    logical: null,
    cores: null,
    packages: null
  }

  if (platform.match(/darwin/i)) {
    getSysctlValue(['hw.packages'], function getPackages(packages) {
      getSysctlValue(['hw.physicalcpu_max', 'hw.physicalcpu'], function getCores(cores) {
        getSysctlValue(
          ['hw.logicalcpu_max', 'hw.logicalcpu', 'hw.ncpu'],
          function getLogicalCpu(logical) {
            processorStats.logical = parseFloat(logical, 10)
            processorStats.cores = parseFloat(cores, 10)
            processorStats.packages = parseFloat(packages, 10)

            for (const key in processorStats) {
              if (!processorStats[key] || !isInteger(processorStats[key])) {
                processorStats[key] = null
              }
            }

            callback(processorStats)
          }
        )
      })
    })
  } else if (platform.match(/bsd/i)) {
    getSysctlValue(['hw.ncpu'], function getLogicalCpu(logical) {
      processorStats.logical = logical
      callback(processorStats)
    })
  } else if (platform.match(/linux/i)) {
    readProc('/proc/cpuinfo', function parseProc(err, data) {
      callback(parseCpuInfo(data))
    })
  } else {
    logger.debug('Unknown platform: %s; could not retrieve processor info', platform)
    callback(processorStats)
  }
}

// placed on module for mocking purposes in tests
module.exports._getMemoryStats = function getMemoryStats(callback) {
  if (platform.match(/darwin/i)) {
    getSysctlValue(['hw.memsize'], function getMem(memory) {
      callback(parseInt(memory, 10) / (1024 * 1024))
    })
  } else if (platform.match(/bsd/i)) {
    getSysctlValue(['hw.realmem'], function getMem(memory) {
      callback(parseInt(memory, 10) / (1024 * 1024))
    })
  } else if (platform.match(/linux/i)) {
    readProc('/proc/meminfo', function parseProc(err, data) {
      callback(parseMemInfo(data))
    })
  } else {
    logger.debug('Unknown platform: %s; could not retrieve memory info', platform)
    callback(null)
  }
}

function getKernelVersion(callback) {
  if (platform.match(/darwin/i)) {
    getSysctlValue(['kern.version'], function getMem(version) {
      callback(version)
    })
  } else if (platform.match(/bsd/i)) {
    getSysctlValue(['kern.version'], function getMem(version) {
      callback(version)
    })
  } else if (platform.match(/linux/i)) {
    readProc('/proc/version', function parseProc(err, data) {
      callback(data)
    })
  } else {
    logger.debug('Unknown platform: %s; could not read kernel version', platform)
    callback(null)
  }
}

function getSysctlValue(names, callback) {
  if (!names) {
    return callback(null)
  }
  let returned = false
  let ran = 0
  names.forEach(function sysctlName(name) {
    exec('sysctl -n ' + name, respond)

    function respond(err, stdout, stderr) {
      if (returned) {
        return
      }
      if (err) {
        logger.debug('Error when trying to run: sysctl -n %s: %s', name, err.message)
        callback(null)
        returned = true
      } else if (!stderr) {
        callback(stdout)
        returned = true
      }
      if (++ran === names.length && !returned) {
        logger.debug('No sysctl info found for names: %j', names)
        callback(null)
      }
    }
  })
}
