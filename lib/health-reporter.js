/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')

const defaultLogger = require('./logger').child({ component: 'HealthReporter' })

const VALID_CODES = new Map([
  ['NR-APM-000', 'Healthy.'],
  ['NR-APM-001', 'Invalid license key.'],
  ['NR-APM-002', 'License key missing.'],
  ['NR-APM-003', 'Forced disconnect received from New Relic.'],
  ['NR-APM-004', 'HTTP error communicating with New Relic.'],
  ['NR-APM-005', 'Missing application name in agent configuration.'],
  ['NR-APM-006', 'The maximum number of configured app names is exceeded.'],
  ['NR-APM-007', 'HTTP proxy is misconfigured.'],
  ['NR-APM-008', 'Agent is disabled via configuration.'],
  ['NR-APM-009', 'Failed to connect to the New Relic data collector.'],
  ['NR-APM-010', 'Agent config could not be parsed.'],
  ['NR-APM-099', 'Agent has shutdown.'],
  // Codes 300 through 399 are reserved for the Node.js Agent.
  ['NR-APM-300', 'An unexpected error occurred.']
])

function writeStatus({ file, healthy = true, code, msg, startTime, callback } = {}) {
  const currentTime = Number(process.hrtime.bigint())
  const yaml = [
    `healthy: ${healthy}`,
    `status: '${msg}'`,
    `last_error: ${code}`,
    `start_time_unix_nano: ${startTime}`,
    `status_time_unix_nano: ${currentTime}`
  ].join('\n')
  fs.writeFile(file, yaml, { encoding: 'utf8' }, callback)
}

/**
 * HealthReporter implements the "super agent" (New Relic Control) health
 * check spec. An instance of the reporter will continually write out the
 * current status, as set by `reporter.setStatus`, on the interval defined
 * by the environment.
 */
class HealthReporter {
  #enabled = false
  #status = HealthReporter.STATUS_HEALTHY
  #interval
  #destFile
  #logger
  #startTime

  static STATUS_HEALTHY = 'NR-APM-000'
  static STATUS_INVALID_LICENSE_KEY = 'NR-APM-001'
  static STATUS_LICENSE_KEY_MISSING = 'NR-APM-002'
  static STATUS_FORCED_DISCONNECT = 'NR-APM-003'
  static STATUS_BACKEND_ERROR = 'NR-APM-004'
  static STATUS_MISSING_APP_NAME = 'NR-APM-005'
  static STATUS_MAXIMUM_APP_NAMES_EXCEEDED = 'NR-APM-006'
  static STATUS_HTTP_PROXY_MISCONFIGURED = 'NR-APM-007'
  static STATUS_AGENT_DISABLED = 'NR-APM-008'
  static STATUS_CONNECT_ERROR = 'NR-APM-009'
  static STATUS_CONFIG_PARSE_FAILURE = 'NR-APM-010'
  static STATUS_AGENT_SHUTDOWN = 'NR-APM-099'

  // STATUS_INTERNAL errors are the Node.js Agent specific error codes.
  static STATUS_INTERNAL_UNEXPECTED_ERROR = 'NR-APM-300'

  constructor({
    agentConfig = { agent_control: { health: {} } },
    logger = defaultLogger,
    setInterval = global.setInterval
  } = {}) {
    const fleetId = agentConfig.agent_control?.fleet_id
    const outDir = agentConfig.agent_control?.health?.delivery_location
    let checkInterval = agentConfig.agent_control?.health?.frequency

    this.#logger = logger

    if (!fleetId) {
      this.#logger.info('new relic control not present, skipping health reporting')
      return
    }

    if (outDir === undefined) {
      this.#logger.error('health check output directory not provided, skipping health reporting')
      return
    }

    if (checkInterval === undefined) {
      this.#logger.debug('health check interval not available, using default 5 seconds')
      checkInterval = 5_000
    } else {
      checkInterval = parseInt(checkInterval, 10) * 1_000
    }

    this.#startTime = Number(process.hrtime.bigint())

    const uuid = crypto.randomUUID().replaceAll('-', '')
    this.#destFile = path.join(outDir, `health-${uuid}.yaml`)

    this.#logger.info(
      `new relic control is present, writing health on interval ${checkInterval} milliseconds to ${
        this.#destFile
      }`
    )
    this.#interval = setInterval(this.#healthCheck.bind(this), checkInterval)
    this.#interval.unref()

    this.#enabled = true
    this.#logger.info('health reporter initialized')
  }

  #healthCheck() {
    const healthy = this.#status === HealthReporter.STATUS_HEALTHY
    writeStatus({
      file: this.#destFile,
      healthy,
      startTime: this.#startTime,
      code: this.#status,
      msg: VALID_CODES.get(this.#status),
      callback: (error) => {
        if (error) {
          this.#logger.error(`error when writing out health status: ${error.message}`)
        }
      }
    })
  }

  /**
   * Update the known health status. This status will be written to the health
   * file on the next interval. If the provided status is not a recognized
   * status, a log will be written and the status will not be updated.
   *
   * @param {string} status Utilize one of the static status fields.
   */
  setStatus(status) {
    if (this.#enabled === false) {
      return
    }

    if (VALID_CODES.has(status) === false) {
      this.#logger.warn(`invalid health reporter status provided: ${status}`)
      return
    }

    if (
      status === HealthReporter.STATUS_AGENT_SHUTDOWN &&
      this.#status !== HealthReporter.STATUS_HEALTHY
    ) {
      this.#logger.info(
        `not setting shutdown health status due to current status code: ${this.#status}`
      )
      return
    }

    this.#status = status
  }

  /**
   * This should be invoked on agent shutdown after setting the status
   * to the shutdown status. It will stop the ongoing update interval,
   * initiate an immediate write of the status file, and then invoke the
   * provided callback.
   *
   * @param {function} done Callback to be invoked after the status file has
   * been updated.
   */
  stop(done) {
    if (this.#enabled === false) {
      done && done()
      return
    }

    clearInterval(this.#interval)

    const healthy = this.#status === HealthReporter.STATUS_HEALTHY
    let code = this.#status
    let msg = VALID_CODES.get(code)
    if (healthy === true) {
      // We only update the status on shutdown when the last known state is
      // the healthy state. Otherwise, we need to leave the current code in
      // place, and just update the report time.
      code = HealthReporter.STATUS_AGENT_SHUTDOWN
      msg = VALID_CODES.get(code)
    }

    writeStatus({
      file: this.#destFile,
      startTime: this.#startTime,
      healthy,
      code,
      msg,
      callback: (error) => {
        if (error) {
          this.#logger.error(
            `error when writing out health status during shutdown: ${error.message}`
          )
        }
        done && done()
      }
    })
  }
}

module.exports = HealthReporter
