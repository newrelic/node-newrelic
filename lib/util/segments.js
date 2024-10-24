/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/**
 * Increments the counts on transaction and agent
 * around total segments
 *
 * @param {Transaction} transaction active transaction
 */
module.exports = function incrementSegments(transaction) {
  ++transaction.numSegments
  ++transaction.agent.totalActiveSegments
  ++transaction.agent.segmentsCreatedInHarvest
}
