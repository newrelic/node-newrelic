'use strict'

const EventEmitter = require('events').EventEmitter

class Aggregator extends EventEmitter {
  constructor(opts, collector) {
    super()

    this.periodMs = opts.periodMs
    this.limit = opts.limit
    this.runId = opts.runId
    this.method = opts.method

    this.collector = collector

    this.sendTimer = null
  }

  start() {
    // TODO: log something useful on start?

    if (!this.sendTimer) {
      // TODO: need to keep track of start time / last harvest?

      this.sendTimer = setInterval(this.send.bind(this), this.periodMs)
      this.sendTimer.unref()
    }
  }

  stop() {
    if (this.sendTimer) {
      // TODO: log something useful on stop
      clearInterval(this.sendTimer)
      this.sendTimer = null
    }
  }

  merge() {
    throw new Error('merge is not implemented')
  }

  add() {
    throw new Error('add is not implemented')
  }

  toPayload() {
    throw new Error('toPayload is not implemented')
  }

  getData() {
    throw new Error('getData is not implemented')
  }

  clear() {
    throw new Error('clear not implemented')
  }

  send() {
    // TODO: log?
    this.emit(`starting ${this.method} data send.`)

    const data = this.getData()
    const payload = this.toPayload()

    if (!payload) {
      // TODO: log something about no data to send.
      // or maybe not since handled in topayload?
      // maybe do just here?
      // May be better to handle ont he tranport side
      // as a consistent spot
      this.emit(`finished ${this.method} data send.`)
      return
    }

    this.clear()

    // This can be synchronous for the serverless collector.
    this.collector[this.method](payload, (error, response) => {
      if (response && response.retainData) {
        this.merge(data)
      }

      // TODO: Log?
      this.emit(`finished ${this.method} data send.`)
    })
  }

  reconfigure(config) {
    this.runId = config.run_id
  }
}

module.exports = Aggregator
