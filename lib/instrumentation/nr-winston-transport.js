/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const TransportStream = require('winston-transport')
const logger = require('../logger').child({ component: 'nr-winston-transport' })
const { truncate } = require('../util/application-logging')

/**
 * Transport used to prepare a log line and add to the new relic agent
 * log aggregator.
 *
 * Note*: This copies the log line so no other transports will get the
 * mutated data.
 */
class NrTransport extends TransportStream {
  constructor(opts = {}) {
    // set this option to have winston handle uncaught exceptions
    // See: https://github.com/winstonjs/winston#handling-uncaught-exceptions-with-winston
    opts.handleExceptions = true
    super(opts)
    this.name = 'newrelic'
    this.agent = opts.agent
    this.config = opts.agent.config
  }

  /**
   * Executed on every log line. We will get the linking metadata
   * and add this, along with reformatting of timestamp and error
   * to a copy of the log line
   *
   * @param {object} logLine a winston log line
   * @param {Function} callback callback to invoke once we are done
   */
  log(logLine, callback) {
    const metadata = this.agent.getLinkingMetadata()
    const formattedLine = reformatLogLine(logLine, metadata)
    this.agent.logs.add(formattedLine)
    callback()
  }
}

module.exports = NrTransport

/**
 * Reformats a log line by reformatting errors, timestamp and adding
 * new relic linking metadata(context). When uncaught exceptions exist
 * an exception property will exist on the log line.  This will tell us
 * that we need to reformat the error
 *
 * @param {object} logLine log line
 * @param {object} metadata linking metadata
 * @returns {object} copy of log line with NR linking metadata
 */
function reformatLogLine(logLine, metadata) {
  // Add the metadata to a copy of the logLine
  const formattedLine = Object.assign({}, logLine, metadata)

  if (formattedLine.exception === true) {
    reformatError(formattedLine)
  }

  reformatTimestamp(formattedLine)

  return formattedLine
}

/**
 * Decorates the log line with  truncated error.message, error.class, and error.stack and removes
 * trace and stack
 *
 * @param {object} logLine a log line
 */
function reformatError(logLine) {
  // Due to Winston internals sometimes the error on the logLine object is a string or an
  // empty object, and so the message property is all we have
  const errorMessage = logLine.error.message || logLine.message || ''

  logLine['error.message'] = truncate(errorMessage)
  logLine['error.class'] =
    logLine.error.name === 'Error' ? logLine.error.constructor.name : logLine.error.name
  logLine['error.stack'] = truncate(logLine.error.stack)
  logLine.message = truncate(logLine.message)

  // Removes additional capture of stack to reduce overall payload/log-line size.
  // The server has a maximum of ~4k characters per line allowed.
  delete logLine.trace
  delete logLine.stack
}

/**
 * Turns timestamp into unix timestamp. If timestamp existed it will move original
 * to `original_timestamp` key
 *
 * @param {object} logLine a log line
 */
function reformatTimestamp(logLine) {
  if (logLine.timestamp) {
    logger.traceOnce(
      'Overwriting `timestamp` key; assigning original value to `original_timestamp`.'
    )
    logLine.original_timestamp = logLine.timestamp
  }
  logLine.timestamp = Date.now()
}
