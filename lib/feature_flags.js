'use strict'

// unreleased flags gating an active feature
exports.prerelease = {
  proxy: true,
  mysql_pool: true,
  custom_instrumentation: true,
  cat: true
}

// flags that are no longer used for released features
exports.released = [
  'released',
  'express4',
  'insights',
  'postgres',
]

// flags that are no longer used for unreleased features
exports.unreleased = [
  'unreleased'
]
