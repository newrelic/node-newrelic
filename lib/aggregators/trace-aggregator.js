'use strict'

const Aggregator = require('./base-aggregator')

class TraceAggregator extends Aggregator {
  constructor(opts, collector) {
    super(opts, collector)
  }
}

module.exports = TraceAggregator
