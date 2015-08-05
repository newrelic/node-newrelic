'use strict'

var exec = require('child_process').exec
var fetchAWSInfo = require('./aws-info')
var fs = require('fs')
var logger = require('./logger.js').child({component: 'system-info'})
var os = require('os')
var parseCpuInfo = require('./parse-proc-cpuinfo')
var parseDockerInfo = require('./parse-dockerinfo')
var parseMemInfo = require('./parse-proc-meminfo')
var platform = os.platform()

module.exports = fetchSystemInfo
module.exports.clearCache = function clearAWSCache() {
  systemInfo = null
}

var systemInfo

function fetchSystemInfo(agent, callback) {
  if (systemInfo) return callback(systemInfo)

  systemInfo = {
    processorArch: os.arch()
  }

  var tasksDone = 0
  var numTasks = 5
  function finishedResponse() {
    if (++tasksDone === numTasks) return callback(systemInfo)
  }

  getProcessorStats(function getProcessCB(processorStats) {
    systemInfo.packages = processorStats.packages
    systemInfo.logicalProcessors = processorStats.logical
    systemInfo.cores = processorStats.cores
    finishedResponse()
  })
  getMemoryStats(function getMemCB(memory) {
    systemInfo.memory = memory
    finishedResponse()
  })
  getKernelVersion(function getVersionCB(kernelVersion) {
    systemInfo.kernelVersion = kernelVersion
    finishedResponse()
  })
  getDockerContainerId(agent, function getContainerId(containerId) {
    systemInfo.docker = {
      id: containerId
    }
    finishedResponse()
  })
  fetchAWSInfo(agent, function getAWSInfo(aws) {
    systemInfo.aws = aws
    finishedResponse()
  })
}

function getProcessorStats(callback) {
  var processorStats = {
    logical: null,
    cores: null,
    packages: null
  }

  if (platform.match(/darwin/i)) {
    getSysctlValue(['hw.packages'], function getPackages(packages) {
      getSysctlValue(['hw.physicalcpu_max', 'hw.physicalcpu'],
      function getCores(cores) {
        getSysctlValue(['hw.logicalcpu_max', 'hw.logicalcpu', 'hw.ncpu'],
        function getLogicalCpu(logical) {
          processorStats.logical = parseInt(logical, 10)
          processorStats.cores = parseInt(cores, 10)
          processorStats.packages = parseInt(packages, 10)

          for (var key in processorStats) {
            if (!processorStats[key]) {
              processorStats[key] = null
            }
          }

          callback(processorStats)
        })
      })
    })
  } else if (platform.match(/bsd/i)) {
    getSysctlValue(['hw.ncpu'], function getLogicalCpu(logical) {
      processorStats.logical = logical
      callback(processorStats)
    })
  } else if (platform.match(/linux/i)) {
    readProc('/proc/cpuinfo', function parseProc(data) {
      callback(parseCpuInfo(data))
    })
  } else {
    logger.debug('Unknown platform: ' + platform + ', could not retrieve processor info')
    callback(processorStats)
  }
}

function getMemoryStats(callback) {
  if (platform.match(/darwin/i)) {
    getSysctlValue(['hw.memsize'], function getMem(memory) {
      callback(parseInt(memory, 10) / (1024 * 1024))
    })
  } else if (platform.match(/bsd/i)) {
    getSysctlValue(['hw.realmem'], function getMem(memory) {
      callback(parseInt(memory, 10) / (1024 * 1024))
    })
  } else if (platform.match(/linux/i)) {
    readProc('/proc/meminfo', function parseProc(data) {
      callback(parseMemInfo(data))
    })
  } else {
    logger.debug('Unknown platform: ' + platform + ', could not retrieve memory info')
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
    readProc('/proc/version', function parseProc(data) {
      callback(data)
    })
  } else {
    logger.debug('Unknown platform' + platform + ', could not read kernel version')
    callback(null)
  }
}

function getDockerContainerId(agent, callback) {
  if (!platform.match(/linux/i)) {
    logger.debug('Platform is not a flavor of linux, omitting docker info')
    callback(null)
  } else {
    readProc('/proc/self/cgroup', function getCGroup(data) {
      if (!data) callback(null)
      else callback(parseDockerInfo(agent, data))
    })
  }
}

function getSysctlValue(names, callback) {
  if (!names) return callback(null)
  var returned = false
  var ran = 0
  names.forEach(function sysctlName(name) {
    exec('sysctl -n ' + name, respond)

    function respond(err, stdout, stderr) {
      if (returned) return
      if (err) {
        logger.debug('Error when trying to run: sysctl -n ' + name + ': %s', err.message)
        callback(null)
        returned = true
      } else if (!stderr) {
        callback(stdout)
        returned = true
      }
      if (++ran === names.length && !returned) {
        logger.debug('No sysctl info found for names: ' + names.toString())
        callback(null)
      }
    }
  })
}

function readProc(path, callback) {
  fs.readFile(path, function readProcFile(err, data) {
    if (err) {
      logger.error('Error when trying to read ' + path, err)
      callback(null)
    } else {
      callback(data.toString())
    }
  })
}
