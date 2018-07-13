'use strict'

const NAMES = require('../names')

function recordDistributedTrace(tx, suffix, duration, exclusive) {
  const distTraceReceived = !!tx.acceptedDistributedTrace
  const tag = [
    tx.parentType || 'Unknown',
    tx.parentAcct || 'Unknown',
    tx.parentApp || 'Unknown',
    tx.parentTransportType || 'Unknown',
    'all'
  ].join('/')

  const suffixes = ['', suffix]

  suffixes.forEach(function record(suf) {
    tx.measure(
      `${NAMES.DISTRIBUTED_TRACE.DURATION}/${tag}${suf}`,
      null,
      duration,
      exclusive
    )

    if (tx.hasErrors()) {
      tx.measure(
        `${NAMES.DISTRIBUTED_TRACE.ERRORS}/${tag}${suf}`,
        null,
        duration,
        exclusive
      )
    }

    if (distTraceReceived) {
      tx.measure(
        `${NAMES.DISTRIBUTED_TRACE.TRANSPORT}/${tag}${suf}`,
        null,
        duration,
        exclusive
      )
    }
  })
}

module.exports = recordDistributedTrace
