'use strict'

const NAMES = require('../names')

function recordDistributedTrace(tx, suffix, duration, exclusive) {
  const distTraceReceived = !!tx.parentId
  const tag = [
      tx.parentType || 'Unknown',
      tx.parentAcct || 'Unknown',
      tx.parentApp || 'Unknown',
      tx.parentTransportType || 'Unknown',
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
