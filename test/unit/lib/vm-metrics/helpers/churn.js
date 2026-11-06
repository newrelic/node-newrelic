/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Allocates and discards a large amount of garbage across several macrotask
 * turns to coax the V8 garbage collector into running, yielding between rounds
 * so a performance observer can flush its entries and the per-tick loop sampler
 * has turns to accumulate.
 *
 * @param {number} [rounds] The number of allocation rounds to perform.
 * @returns {Promise} Resolves once the rounds complete.
 */
module.exports = async function churn(rounds = 15) {
  for (let round = 0; round < rounds; round++) {
    let trash = []
    for (let i = 0; i < 200000; i++) {
      trash.push([{ i }])
    }
    trash = null
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}
