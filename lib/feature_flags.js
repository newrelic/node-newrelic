'use strict'

// unreleased flags gating an active feature
exports.prerelease = {
  custom_instrumentation: true,
  custom_metrics: true,
  cat: true
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
