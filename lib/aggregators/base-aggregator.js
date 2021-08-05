/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EventEmitter = require('events').EventEmitter
const logger = require('../logger').child({ component: 'base_aggregator' })

class Aggregator extends EventEmitter {
  constructor(opts, collector) {
    super()

    this.defaultPeriod = this.periodMs = opts.periodMs
    this.defaultLimit = this.limit = opts.limit
    this.runId = opts.runId
    this.isAsync = opts.isAsync || false
    this.method = opts.method

    this.collector = collector

    this.sendTimer = null
  }

  start() {
    logger.trace(`${this.method} aggregator started.`)

    if (!this.sendTimer) {
      this.sendTimer = setInterval(this.send.bind(this), this.periodMs)
      this.sendTimer.unref()
    }
  }

  stop() {
    if (this.sendTimer) {
      clearInterval(this.sendTimer)
      this.sendTimer = null

      logger.trace(`${this.method} aggregator stopped.`)
    }
  }

  _merge() {
    throw new Error('merge is not implemented')
  }

  add() {
    throw new Error('add is not implemented')
  }

  _toPayload(callback) {
    try {
      callback(null, this._toPayloadSync())
    } catch (err) {
      callback(err)
    }
  }

  _toPayloadSync() {
    throw new Error('toPayloadSync is not implemented')
  }

  _getMergeData() {
    throw new Error('getData is not implemented')
  }

  clear() {
    throw new Error('clear not implemented')
  }

  _afterSend() {
    // private hook called after send is finished
  }

  _runSend(data, payload) {
    if (!payload) {
      this._afterSend(false)
      this.emit(`finished ${this.method} data send.`)
      return
    }

    // This can be synchronous for the serverless collector.
    this.collector[this.method](payload, (error, response) => {
      if (response && response.retainData) {
        this._merge(data)
      }

      // TODO: Log?
      this._afterSend(true)
      this.emit(`finished ${this.method} data send.`)
    })
  }

  send() {
    logger.debug(`${this.method} Aggregator data send.`)
    this.emit(`starting ${this.method} data send.`)

    const data = this._getMergeData()
    if (this.isAsync) {
      this._toPayload((err, payload) => {
        this._runSend(data, payload)
      })
    } else {
      this._runSend(data, this._toPayloadSync())
    }

    this.clear()
  }

  reconfigure(config) {
    this.runId = config.run_id
  }
}

module.exports = Aggregator
