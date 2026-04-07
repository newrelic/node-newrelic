'use strict'

const NAMES = require('./names')

function recordMetric(transaction, name, value) {
  if (transaction.ignore) {
    return
  }
  transaction.metrics.getOrCreateMetric(name).recordValue(value)
}

function recordMetrics(transaction, metrics) {
  if (transaction.ignore) {
    return
  }
  for (let i = 0; i < metrics.length; ++i) {
    const metric = metrics[i]
    transaction.metrics.getOrCreateMetric(metric[0]).recordValue(metric[1])
  }
}

function recordValue(transaction, name, value) {
  if (transaction.ignore) {
    return
  }
  transaction.metrics.getOrCreateMetric(name).recordValue(value)
}

function recordValues(transaction, name, values) {
  if (transaction.ignore) {
    return
  }
  const metric = transaction.metrics.getOrCreateMetric(name)
  for (let i = 0; i < values.length; ++i) {
    metric.recordValue(values[i])
  }
}

function recordOnce(transaction, name, value) {
  if (transaction.ignore) {
    return
  }
  const metric = transaction.metrics.getOrCreateMetric(name)
  if (metric.callCount === 0) {
    metric.recordValue(value)
  }
}

function recordMilliseconds(transaction, name, ms) {
  if (transaction.ignore) {
    return
  }
  transaction.metrics.getOrCreateMetric(name).recordValue(ms)
}

module.exports = {
  recordMetric,
  recordMetrics,
  recordValue,
  recordValues,
  recordOnce,
  recordMilliseconds
}
