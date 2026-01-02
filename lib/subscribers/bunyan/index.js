/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BunyanSubscriber = require('./base')
const { truncate } = require('../../util/application-logging')

class BunyanLoggerSubscriber extends BunyanSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_logger' })
    this.events = ['end']
  }

  handler(data, ctx) {
    this.createModuleUsageMetric('bunyan')
    return ctx
  }

  end(data) {
    const self = this
    if (this.isLogForwardingEnabled()) {
      const logger = data.self
      logger.addStream({
        name: 'NRLogForwarder',
        type: 'raw',
        level: logger.level(),
        stream: {
          write: function nrLogWrite(logLine) {
            self.forwardLogLine(logLine)
          }
        }
      })
    }
  }

  reformatLogLine(logLine) {
    // shallow copy, since we're modifying things
    const newLog = Object.assign({}, logLine)
    newLog.timestamp = Date.now()
    newLog.level = this.NAME_FROM_LEVEL[logLine.level]

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
    const metadata = this.agent.getLinkingMetadata(true)
    return Object.assign({}, newLog, metadata)
  }
}

module.exports = BunyanLoggerSubscriber
