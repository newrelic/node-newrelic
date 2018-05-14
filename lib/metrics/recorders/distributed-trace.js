'use strict'

const NAMES = require('../names')

function recordDistributedTrace(tx, prefix, suffix, duration, exclusive) {
  const distTraceReceived = !!tx.parentId
  let tag = 'Unknown/Unknown/Unknown/Unknown/all'
  if (distTraceReceived) {
    tag = [
      tx.parentType,
      tx.parentAcct,
      tx.parentApp,
      tx.parentTransportType,
      'all'
    ].join('/')
  }

  ['', suffix].forEach(function record(bonus) {
    tx.measure(
      `${NAMES.DISTRIBUTED_TRACE.DURATION}/${tag}${bonus}`,
      null,
      duration,
      exclusive
    )

    if (tx.hasErrors()) {
      tx.measure(
        `${NAMES.DISTRIBUTED_TRACE.ERRORS}/${tag}${bonus}`,
        null,
        duration,
        exclusive
      )
    }

    if (distTraceReceived) {
      tx.measure(
        `${NAMES.DISTRIBUTED_TRACE.TRANSPORT}/${tag}${bonus}`,
        null,
        duration,
        exclusive
      )
    }
  })
}

module.exports = recordDistributedTrace
