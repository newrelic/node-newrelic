/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const scopeNames = []
const metricNames = []

fillMetrics()

exports.getNumber = getNumber
exports.getScope = getScope
exports.getMaybeUnscoped = getMaybeUnscoped
exports.getMetric = getMetric

function fillMetrics() {
  for (let i = 0; i < 10; ++i) {
    scopeNames.push('scope/' + i)
  }
  for (let i = 0; i < 100; ++i) {
    metricNames.push('metric/' + i)
  }
}

function getNumber(max) {
  return Math.floor(Math.random() * max)
}

function getScope() {
  return scopeNames[getNumber(scopeNames.length)]
}

function getMaybeUnscoped() {
  return scopeNames[getNumber(scopeNames.length * 3)]
}

function getMetric() {
  return metricNames[getNumber(metricNames.length)]
}
