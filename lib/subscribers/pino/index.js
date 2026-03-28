/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ApplicationLogsSubscriber = require('../application-logs')
const { truncate } = require('../../util/application-logging')
const semver = require('semver')

const NATIVE_CHANNEL_MIN_VERSION = '9.10.0'
const NATIVE_CHANNEL_NAME = 'pino.logger'
const LEGACY_CHANNEL_NAME = 'nr_asJson'

class PinoSubscriber extends ApplicationLogsSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'pino', channelName: LEGACY_CHANNEL_NAME })
    this.events = ['end']
    this._useNativeChannel = false
  }

  subscribe(pinoVersion) {
    if (pinoVersion && semver.gte(pinoVersion, NATIVE_CHANNEL_MIN_VERSION)) {
      this._useNativeChannel = true
      this.channelName = NATIVE_CHANNEL_NAME
      this.events = ['start', 'end']
    }
    super.subscribe()
  }

  handler(data, ctx) {
    this.createModuleUsageMetric('pino')
    if (this._useNativeChannel) {
      return this._nativeHandler(data, ctx)
    }
    const { self, arguments: args } = data
    const level = self?.levels?.labels?.[args[2]]
    this.incrementLinesMetric(level)
    const useMergeObj = this.decorateLogLine(data)
    ctx.extras = { useMergeObj }
    return ctx
  }

  _nativeHandler(data, ctx) {
    const { thisArg: self, args } = data
    const level = self?.levels?.labels?.[args[2]]
    this.incrementLinesMetric(level)
    const useMergeObj = this._nativeDecorateLogLine({ self, args })
    ctx.extras = { useMergeObj }
    return ctx
  }

  _nativeDecorateLogLine({ self, args }) {
    const useMergeObj = args[1] === undefined && Object.hasOwn(args[0], 'msg')
    const meta = super.decorateLogLine()
    if (meta) {
      if (useMergeObj === true) {
        args[0].msg += this.agent.getNRLinkingMetadata()
      } else {
        args[1] += this.agent.getNRLinkingMetadata()
      }
    }
    return useMergeObj
  }

  decorateLogLine(data) {
    // Pino log methods accept a singular object (a merging object) that can
    // have a `msg` property for the log message. In such cases, we need to
    // update that log property instead of the second parameter.
    const useMergeObj = data.arguments[1] === undefined && Object.hasOwn(data.arguments[0], 'msg')
    const meta = super.decorateLogLine()
    if (meta) {
      if (useMergeObj === true) {
        data.arguments[0].msg += this.agent.getNRLinkingMetadata()
      } else {
        data.arguments[1] += this.agent.getNRLinkingMetadata()
      }
    }
    return useMergeObj
  }

  start(data) {
    if (this._useNativeChannel) {
      const ctx = {}
      this._nativeHandler(data, ctx)
      data.__nrCtx = ctx
    }
  }

  end(data) {
    if (this._useNativeChannel) {
      this._nativeEnd(data)
      return
    }
    this.forwardLogLine(data)
  }

  _nativeEnd(data) {
    const ctx = data.__nrCtx || {}
    delete data.__nrCtx
    this._nativeForwardLogLine(data, ctx)
  }

  _nativeForwardLogLine(data, ctx) {
    const { thisArg: self, args, result: logLine } = data
    if (!logLine) {
      return
    }
    const reformatted = this._nativeReformatLogLine({ self, args, logLine }, ctx)
    if (reformatted) {
      this.agent.logs.add(reformatted)
    }
  }

  _nativeReformatLogLine({ self, args, logLine }, ctx) {
    const subscriber = this
    const msg = ctx?.extras?.useMergeObj === true ? args[0].msg : args[1]
    const level = self?.levels?.labels?.[args[2]]
    const metadata = this.agent.getLinkingMetadata(true)
    const agentMeta = Object.assign({}, { timestamp: Date.now() }, metadata)
    // eslint-disable-next-line eqeqeq
    if (msg != undefined) {
      agentMeta.message = msg
    }
    return function formatLogLine() {
      let formattedLog
      try {
        formattedLog = JSON.parse(logLine)
      } catch (err) {
        subscriber.logger.error('Failed to parse log line as json: %s', err.message)
        return
      }
      if (formattedLog.err) {
        formattedLog['error.message'] = truncate(formattedLog.err.message)
        formattedLog['error.stack'] = truncate(formattedLog.err.stack)
        formattedLog['error.class'] = formattedLog.err.type
        delete formattedLog.err
      }
      Object.assign(formattedLog, agentMeta)
      formattedLog.level = level
      delete formattedLog.time
      delete formattedLog.msg
      return formattedLog
    }
  }

  /**
   * reformats error and assigns NR context data
   * to log line
   *
   * @param {object} data event passed to the end handler
   * @param {object} ctx agent context object
   * @returns {Function} wrapped log formatter function
   */
  reformatLogLine(data, ctx) {
    const subscriber = this
    const { self, result: logLine, arguments: args } = data
    if (!logLine) {
      return
    }
    const msg = ctx?.extras?.useMergeObj === true ? args[0].msg : args[1]
    const level = self?.levels?.labels?.[args[2]]
    const metadata = this.agent.getLinkingMetadata(true)

    const agentMeta = Object.assign({}, { timestamp: Date.now() }, metadata)
    // eslint-disable-next-line eqeqeq
    if (msg != undefined) {
      // The spec lists `message` as "MUST" under the required column, but then
      // details that it "MUST be omitted" if the value is "empty". Additionally,
      // if someone has logged only a merging object, and that object contains a
      // message key, we do not want to overwrite their value. See issue 2595.
      agentMeta.message = msg
    }

    /**
     * A function that gets executed in `_toPayloadSync` of log aggregator.
     * This will parse the serialized log line and then add the relevant NR
     * context metadata and rename the time/msg keys to timestamp/message
     * @returns {object|undefined} formatted log line, or undefined if an error occurred
     */
    return function formatLogLine() {
      let formattedLog
      try {
        formattedLog = JSON.parse(logLine)
      } catch (err) {
        subscriber.logger.error('Failed to parse log line as json: %s', err.message)
        return
      }

      if (formattedLog.err) {
        formattedLog['error.message'] = truncate(formattedLog.err.message)
        formattedLog['error.stack'] = truncate(formattedLog.err.stack)
        formattedLog['error.class'] = formattedLog.err.type
        delete formattedLog.err
      }

      Object.assign(formattedLog, agentMeta)
      formattedLog.level = level
      delete formattedLog.time
      delete formattedLog.msg
      return formattedLog
    }
  }
}

module.exports = PinoSubscriber
