/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// An outbound request errors with no `error` listener, so the emitter rethrows
// it, and the app handles `uncaughtException` and keeps running. The error must
// be reported once, with its transaction, on the external span.
const assert = require('node:assert')
const net = require('node:net')
const helper = require('#testlib/agent_helper.js')
const agent = helper.instrumentMockedAgent()
const http = require('node:http')

const HOST = '127.0.0.1'

/**
 * Gets the agent attributes of the span event with the given name.
 *
 * @param {string} name The name of the span.
 * @returns {object} The span's agent attributes.
 */
function getSpanAttributes(name) {
  const span = agent.spanEventAggregator.getEvents().find((s) => s.intrinsics.name === name)
  assert.ok(span, `should create a ${name} span`)
  return span.toJSON()[2]
}

// get a port nothing listens on, so the request is refused
const probe = net.createServer().listen(0, HOST, () => {
  const { port } = probe.address()
  probe.close(() => run(port))
})

function run(port) {
  helper.runInNamedTransaction(agent, (transaction) => {
    process.once('uncaughtException', (error) => {
      assert.equal(error.code, 'ECONNREFUSED')
      transaction.end()

      const traces = agent.errors.traceAggregator.errors
      assert.equal(traces.length, 1, 'should collect one error trace')
      assert.equal(traces[0][1], 'TestTransaction', 'should collect the error with its transaction')
      assert.equal(agent.errors.eventAggregator.getEvents().length, 1, 'should create one error event')
      assert.equal(agent.metrics.getMetric('Errors/all').callCount, 1, 'should count the error once')

      const external = getSpanAttributes(`External/${HOST}:${port}/`)
      assert.equal(external['error.class'], 'Error', 'should add the error class to the external span')
      assert.equal(external['error.message'], error.message, 'should add the error message to the external span')
      const connect = getSpanAttributes('net.Socket.connect')
      assert.ok(!('error.class' in connect), 'should not add the error to the socket connect span')
    })

    // no `error` listener
    http.get({ host: HOST, port, path: '/' })
  })
}
