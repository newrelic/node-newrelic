/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')
const { fileURLToPath } = require('node:url')

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

function getTime() {
  // `process.hrtime.bigint` does not return a value relative to the epoch.
  // So we have to perform this lossy calculation because the spec is
  // insisting on nanoseconds.
  return Date.now() * 1_000_000
}

function writeStatus({ file, entityGuid, healthy = true, code, msg, startTime, callback } = {}) {
  const currentTime = getTime()
  const yaml = [
    `entity_guid: ${entityGuid}`,
    `healthy: ${healthy}`,
    `status: '${msg}'`,
    `last_error: ${code}`,
    `start_time_unix_nano: ${startTime}`,
    `status_time_unix_nano: ${currentTime}`
  ].join('\n')
  fs.writeFile(file, yaml, { encoding: 'utf8' }, callback)
}

function directoryAvailable(dest) {
  try {
    fs.accessSync(dest, fs.constants.R_OK | fs.constants.W_OK)
    return { available: true }
  } catch (error) {
    return { available: false, error }
  }
}

/**
 * HealthReporter implements the "super agent" (New Relic Control) health
 * check spec. An instance of the reporter will continually write out the
 * current status, as set by `reporter.setStatus`, on the interval defined
 * by the environment.
 */
class HealthReporter {
  #agentConfig = {}
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

  /**
   * @typedef {object} AgentControlConfig
   * @property {boolean} [enabled=false] Whether or not the agent control
   * feature should be enabled.
   * @property {object} health Configuration for the health reporting component
   * of agent control.
   * @property {string} health.outDir Path to the directory where status files
   * will be written. May be a file URI.
   * @property {number} health.frequency The time, in seconds, that will be
   * used as the update interval for writing out health status.
   */

  /**
   * Build a new health reporter instance.
   *
   * Important: the shape of `agentConfig` will not be validated. It is expected
   * that this module is used in the context of the agent. Therefore, a
   * properly shaped configuration object should always be available and passed
   * in.
   *
   * @param {object} [params] Construction parameters.
   * @param {object} params.agentConfig A standard `newrelic` configuration
   * object that has an `agent_control` property which is an instance of
   * {@link AgentControlConfig}.
   * @param {object} [params.logger] A standard logger instance.
   * @param {Function} [params.setInterval] A function to use as `setInterval`.
   * Must return an interval object that supports the `unref()` method.
   */
  constructor({
    agentConfig,
    logger = defaultLogger,
    setInterval = global.setInterval
  } = {}) {
    this.#agentConfig = agentConfig
    const enabled = agentConfig?.agent_control?.enabled
    const checkInterval = parseInt(agentConfig?.agent_control?.health?.frequency, 10) * 1_000
    let outDir = agentConfig?.agent_control?.health?.delivery_location

    this.#logger = logger

    if (enabled !== true) {
      this.#logger.info('new relic agent control disabled, skipping health reporting')
      return
    }

    if (outDir.includes('://') === true) {
      outDir = fileURLToPath(outDir)
    }
    const dirCheck = directoryAvailable(outDir)
    if (dirCheck.available === false) {
      this.#logger.error('health check output directory not accessible, skipping health reporting', { error: dirCheck.error })
      return
    }

    this.#startTime = getTime()

    const uuid = crypto.randomUUID().replaceAll('-', '')
    this.#destFile = path.join(outDir, `health-${uuid}.yaml`)

    this.#logger.info(
      `new relic agent control is present, writing health on interval ${checkInterval} milliseconds to ${
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
      entityGuid: this.#agentConfig.entity_guid || '',
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

  get enabled() {
    return this.#enabled
  }

  get destFile() {
    return this.#destFile
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
   * @param {Function} done Callback to be invoked after the status file has
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
      entityGuid: this.#agentConfig.entity_guid || '',
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
