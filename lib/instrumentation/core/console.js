/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')

const {
  isApplicationLoggingEnabled,
  isLogForwardingEnabled,
  isLocalDecoratingEnabled,
  isMetricsEnabled,
  incrementLoggingLinesMetrics,
  truncate
} = require('../../util/application-logging')

function consoleCaptureEnabled(agent) {
  const config = agent.config
  const logForwarding = isLogForwardingEnabled(config, agent)
  const localDecoration = isLocalDecoratingEnabled(config)
  const metrics = isMetricsEnabled(config)
  const enabled =
    isApplicationLoggingEnabled(config) &&
    config.application_logging.capture_console.enabled &&
    (logForwarding || localDecoration || metrics)
  return enabled
    ? {
        logForwarding,
        localDecoration,
        metrics
      }
    : false
}

function logLevelFromFunction(methodName) {
  return methodName === 'log' || methodName === 'dir' ? 'info' : methodName
}

function formatMessage(methodName, args) {
  return truncate(
    methodName === 'dir' ? util.inspect.apply(util, args) : util.format.apply(util, args)
  )
}

function initialize(agent, nodule, name, shim) {
  if (!nodule) {
    return false
  }
  const logConfig = consoleCaptureEnabled(agent)
  if (!logConfig) {
    shim.logger.debug('Application logging not enabled. Not instrumenting console logging.')
    return
  }

  shim.wrap(
    nodule,
    ['log', 'dir', 'info', 'debug', 'warn', 'error'],
    function wrapLog(_shim, origLog, methodName) {
      return function wrappedLog() {
        const args = shim.argsToArray.apply(shim, arguments)

        const logLevel = logLevelFromFunction(methodName)
        if (logConfig.metrics) {
          incrementLoggingLinesMetrics(logLevel, agent.metrics)
        }

        let message = formatMessage(methodName, args)

        if (logConfig.localDecoration) {
          message = message + agent.getNRLinkingMetadata()
          return origLog.apply(this, [message])
        } else if (logConfig.logForwarding) {
          const metadata = agent.getLinkingMetadata(true)
          agent.logs.add({
            message,
            timestamp: Date.now(),
            level: logLevel,
            ...metadata
          })
        }
        return origLog.apply(this, args)
      }
    }
  )
}

module.exports = initialize
