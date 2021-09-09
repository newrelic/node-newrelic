/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger.js').child({ component: 'pcf-info' })
const NAMES = require('../metrics/names.js')
const common = require('./common')

module.exports = fetchPCFInfo

function fetchPCFInfo(agent, callback) {
  if (!agent.config.utilization || !agent.config.utilization.detect_pcf) {
    return setImmediate(callback, null, null)
  }

  const metadataMap = {
    CF_INSTANCE_GUID: 'cf_instance_guid',
    CF_INSTANCE_IP: 'cf_instance_ip',
    MEMORY_LIMIT: 'memory_limit'
  }

  const results = Object.create(null)
  const keys = Object.keys(metadataMap)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = process.env[key]
    if (value == null) {
      logger.trace('Could not find environment value for %s', key)
      return setImmediate(callback, null, null)
    }
    if (!common.checkValueString(value)) {
      logger.trace('Invalid environment value for %s: %j', key, value)
      agent.metrics.getOrCreateMetric(NAMES.UTILIZATION.PCF_ERROR).incrementCallCount()
      return setImmediate(callback, null, null)
    }
    results[metadataMap[key]] = value
  }

  setImmediate(callback, null, results)
}
