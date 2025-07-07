/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('./base')
const urltils = require('../util/urltils')
const { ALL, DB } = require('../metrics/names')

class DbSubscriber extends Subscriber {
  constructor(agent, id, system) {
    super(agent, id)
    this.system = system
    this.config = agent.config
    this._metrics = {
      PREFIX: this.system,
      ALL: `${DB.PREFIX}${this.system}/${ALL}`
    }
    this.instanceKeys = ['host', 'port_path_or_id']
    this.hostKey = 'host'
    this.dbNameKey = 'database_name'
    this.requireActiveTx = true
  }

  get instanceReporting() {
    return this._agent.config.datastore_tracer.instance_reporting.enabled
  }

  get dbNameReporting() {
    return this._agent.config.datastore_tracer.database_name_reporting.enabled
  }

  addAttributes(segment) {
    for (let [key, value] of Object.entries(this.parameters)) {
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
