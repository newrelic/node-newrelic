/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('./base')
const { ALL, DB } = require('../metrics/names')
const urltils = require('../util/urltils')

/**
 * @property {object} parameters Must be set by subclasses prior to invoking
 * the `addAttributes` method. Should contain the following keys:
 * - `host`: The database host.
 * - `database_name`: The name of the database.
 * - `port_path_or_id`: The database port, path, or ID.
 * @property {string} system The database system being used (e.g., MySQL, MongoDB).
 */
class DbSubscriber extends Subscriber {
  /**
   * @param {object} params constructor params object
   * @param {object} params.agent A New Relic Node.js agent instance.
   * @param {object} params.logger An agent logger instance.
   * @param {string} params.packageName The package name being instrumented.
   * This is what a developer would provide to the `require` function.
   * @param {string} params.channelName A unique name for the diagnostics channel
   * that will be created and monitored.
   * @param {string} params.system The database system being used (e.g., MySQL, MongoDB).
   */
  constructor({ agent, logger, packageName, channelName, system }) {
    super({ agent, logger, packageName, channelName })
    this.system = system
    // must be prefixed with `_` as that's what the metrics recorder expects
    this._metrics = {
      PREFIX: this.system,
      ALL: `${DB.PREFIX}${this.system}/${ALL}`
    }
    this.instanceKeys = ['host', 'port_path_or_id']
    this.hostKey = 'host'
    this.dbNameKey = 'database_name'
  }

  get instanceReporting() {
    return this.config.datastore_tracer.instance_reporting.enabled
  }

  get dbNameReporting() {
    return this.config.datastore_tracer.database_name_reporting.enabled
  }

  /**
   * Adds `this.parameters` to the active segment.
   * @param {object} segment the current segment
   */
  addAttributes(segment) {
    for (let [key, value] of Object.entries(this.parameters ?? {})) {
      if (this.instanceKeys.includes(key) && !this.instanceReporting) {
        continue
      }

      if (key === this.dbNameKey && !this.dbNameReporting) {
        continue
      }

      if (key === this.hostKey && urltils.isLocalhost(value)) {
        // eslint-disable-next-line sonarjs/updated-loop-counter
        value = this.config.getHostnameSafe()
      }

      if (key === this.dbNameKey && typeof value === 'number') {
        // eslint-disable-next-line sonarjs/updated-loop-counter
        value = String(value)
      }

      segment.addAttribute(key, value)
    }
  }
}

module.exports = DbSubscriber
