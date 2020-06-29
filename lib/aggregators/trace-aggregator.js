/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Aggregator = require('./base-aggregator')

class TraceAggregator extends Aggregator {
  constructor(opts, collector) {
    super(opts, collector)
  }
}

module.exports = TraceAggregator
