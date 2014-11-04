'use strict'

// unreleased flags gating an active feature
exports.prerelease = {
  cat: true,
  custom_events: false,
  custom_instrumentation: true,
  custom_metrics: true
}

// flags that are no longer used for released features
exports.released = [
  'released',
  'express4',
  'insights',
  'postgres',
  'mysql_pool',
  'proxy'
]

// flags that are no longer used for unreleased features
exports.unreleased = [
  'unreleased'
]
