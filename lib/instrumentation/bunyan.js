/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  isApplicationLoggingEnabled,
  isLogForwardingEnabled,
  isLocalDecoratingEnabled,
  isMetricsEnabled,
  createModuleUsageMetric,
  incrementLoggingLinesMetrics
} = require('../util/application-logging')

const MAX_LENGTH = 1021
const OUTPUT_LENGTH = 1024
const truncate = (str) => {
  if (str && str.length > OUTPUT_LENGTH) {
    return str.substring(0, MAX_LENGTH) + '...'
  }

  return str
}

const logger = require('../logger').child({ component: 'bunyan' })

function augmentLogData(originalLog, agent) {
  const newLog = {}
  // shallow copy, since we're modifying things
  Object.keys(originalLog).forEach(function copyAttr(k) {
    newLog[k] = originalLog[k]
  })
  newLog.timestamp = Date.now()

  // put log message into a consistent spot and ensure it's not too long
  newLog.message = truncate(newLog.msg)

  // tidy up the error output to help with max length restrictions
  if (newLog.err) {
    newLog['error.message'] = truncate(newLog.err.message)
    newLog['error.stack'] = truncate(newLog.err.stack)
    newLog['error.class'] =
      newLog.err.name === 'Error' ? newLog.err.constructor.name : newLog.err.name
    // clear out the old error message
    delete newLog.err
  }

  // Add the metadata to the object being logged
  const metadata = agent.getLinkingMetadata(true)
  Object.keys(metadata).forEach((m) => {
    newLog[m] = metadata[m]
  })

  return newLog
}

function createLoggerWrapper(shim, fn, fnName, bunyanLogger) {
  const agent = shim.agent

  createModuleUsageMetric('bunyan', agent.metrics)

  // forward logs via the agent logs aggregator
  bunyanLogger.addStream({
    name: 'NRLogForwarder',
    type: 'raw',
    level: bunyanLogger.level(),
    stream: {
      write: function nrLogWrite(logLine) {
        agent.logs.add(augmentLogData(logLine, agent))
      }
    }
  })
  // no return here means the original return value is preserved
}

module.exports = function instrument(agent, bunyan, _, shim) {
  const config = agent.config

  if (!isApplicationLoggingEnabled(config)) {
    logger.debug('Application logging not enabled. Not instrumenting bunyan.')
    return
  }

  const logForwardingEnabled = isLogForwardingEnabled(config, agent)
  const localDecoratingEnabled = isLocalDecoratingEnabled(config)
  const metricsEnabled = isMetricsEnabled(config)

  if (logForwardingEnabled) {
    shim.wrapReturn(bunyan, 'createLogger', createLoggerWrapper)
  }

  if (metricsEnabled || localDecoratingEnabled) {
    shim.wrap(bunyan.prototype, '_emit', function wrapEmit(_shim, emit) {
      return function wrappedEmit() {
        const args = shim.argsToArray.apply(shim, arguments)
        const rec = args[0]

        if (metricsEnabled) {
          incrementLoggingLinesMetrics(bunyan.nameFromLevel[rec.level], agent.metrics)
        }

        if (localDecoratingEnabled) {
          rec.message = truncate(rec.msg) + agent.getNRLinkingMetadata()
        }
        return emit.apply(this, [rec, args[1]])
      }
    })
  }
}
