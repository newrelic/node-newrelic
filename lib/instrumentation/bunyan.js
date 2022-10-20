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
  incrementLoggingLinesMetrics,
  truncate
} = require('../util/application-logging')

const logger = require('../logger').child({ component: 'bunyan' })

function augmentLogData(originalLog, agent, nameFromLevel) {
  // shallow copy, since we're modifying things
  const newLog = Object.assign({}, originalLog)
  newLog.timestamp = Date.now()
  newLog.level = nameFromLevel[originalLog.level]

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

function createLoggerWrapper(shim, fn, fnName, bunyanLogger, nameFromLevel) {
  const agent = shim.agent

  createModuleUsageMetric('bunyan', agent.metrics)

  // forward logs via the agent logs aggregator
  bunyanLogger.addStream({
    name: 'NRLogForwarder',
    type: 'raw',
    level: bunyanLogger.level(),
    stream: {
      write: function nrLogWrite(logLine) {
        agent.logs.add(augmentLogData(logLine, agent, nameFromLevel))
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
    shim.wrapReturn(bunyan, 'createLogger', createLoggerWrapper, [bunyan.nameFromLevel])
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
        args[0] = rec
        return emit.apply(this, args)
      }
    })
  }
}
