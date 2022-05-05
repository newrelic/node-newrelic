/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Storage mechanism for logs within a transaction
 * As logs are seen during a transaction they are added to the storage
 * if max limit has not been met.  When a transaction ends they are flushed
 * and added to the Log Aggregator and then cleared
 *
 * @param {object} agent the agent
 */
function Logs(agent) {
  this.maxLimit = agent.config.event_harvest_config.harvest_limits.log_event_data
  this.aggregator = agent.logs
  this.storage = []
}

/**
 * Adds a log line to storage if max limit has not been met
 *
 * @param {object} logLine log line to store
 */
Logs.prototype.add = function add(logLine) {
  if (this.storage.length === this.maxLimit) {
    return
  }

  this.storage.push(logLine)
}

/**
 * Adds all logs gathered during transaction to log aggregator
 * with the appropriate priority.  The storage is then cleared out.
 *
 * @param {number} priority of transaction
 */
Logs.prototype.flush = function flush(priority) {
  this.aggregator.addBatch(this.storage, priority)
  this.storage = []
}

module.exports = Logs
