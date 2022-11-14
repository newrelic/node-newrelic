/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('./logger.js').child({ component: 'proc-cpuinfo' })
const PHYSICAL_ID = 'physical id'
const CPU_CORES = 'cpu cores'
const PROCESSOR = 'processor'
const CORE_ID = 'core id'

module.exports = parseProcCPUInfo

function parseProcCPUInfo(data) {
  const relevantAttributes = [PROCESSOR, PHYSICAL_ID, CPU_CORES, CORE_ID]

  let processorStats = {
    logical: null,
    cores: null,
    packages: null
  }

  // In some rare cases the OS may be locked down so that you cannot retrieve this info.
  if (!data) {
    logger.debug('No CPU data to parse, returning empty stats.')
    return processorStats
  }

  // separate the processors
  let splitData = data.split('\n').map(function formatAttribute(attr) {
    return attr.split(':').map(function eliminateExtraWhitespace(s) {
      return s.replace(/\\r|\\t| {2,}/g, '').trim()
    })
  })

  const validData = splitData.filter(function checkForValidAttrs(a) {
    return a.length === 2 && relevantAttributes.indexOf(a[0]) !== -1
  })
  if (validData.length === 0) {
    logger.debug('No applicable cpu attributes found')
    return processorStats
  }

  splitData = collapseMultilineValues(splitData)

  const processors = separateProcessors(splitData)

  processorStats = countProcessorStats(processors)
  if (!processorStats.cores) {
    if (processorStats.logical === 1) {
      // some older, single-core processors might not list ids,
      // so we'll mark them 1
      processorStats.cores = 1
      processorStats.packages = 1
    } else {
      // there is no way of knowing how many packages
      // or cores there are
      processorStats.cores = null
      processorStats.packages = null
    }
  }
  return processorStats
}

// some values are split up over multiple lines, these won't be broken
// by split(':'), and should be folded into the last seen valid value
function collapseMultilineValues(li) {
  const tmp = []
  let last
  for (let i = 0; i < li.length; ++i) {
    if (li[i].length === 2) {
      // store the last valid entry to append invalid entries to
      last = li[i]
      tmp.push(last)
    } else {
      last[1] += li[i][0]
    }
  }

  return tmp
}

// walk through the processed list of key, value pairs and populate
// objects till you find a collision
function separateProcessors(processorData) {
  const processors = []
  let processor = Object.create(null)
  for (let i = 0; i < processorData.length; ++i) {
    const key = processorData[i][0]
    const value = processorData[i][1]
    if (processor[key] !== undefined) {
      processors.push(processor)
      processor = Object.create(null)
    }
    processor[key] = value
  }
  processors.push(processor)
  return processors
}

function countProcessorStats(processors) {
  const phys = []
  const cores = []

  for (let i = 0; i < processors.length; i++) {
    const processor = processors[i]
    if (
      processor[PHYSICAL_ID] &&
      processor[CPU_CORES] &&
      phys.indexOf(processor[PHYSICAL_ID]) === -1
    ) {
      phys.push(processor[PHYSICAL_ID])
      cores.push(processor[CPU_CORES])
    }
  }

  return {
    logical: processors.length,
    cores: cores
      .map(function convertToInt(s) {
        return parseInt(s, 10)
      })
      .reduce(function sum(a, b) {
        return a + b
      }, 0),
    packages: phys.length
  }
}
