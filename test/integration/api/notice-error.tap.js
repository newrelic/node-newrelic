/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')

test('http errors are noticed correctly', function testError(t) {
  const agent = helper.loadTestAgent(t)

  t.plan(3)
  const http = require('http')
  const server = http.createServer(handler)

  server.listen(0)

  http.get({
    path: '/test?thing=123',
    host: 'localhost',
    port: server.address().port
  }, close)

  function handler(req, res) {
    agent.errors.add(agent.getTransaction(), new Error('notice me!'))
    req.resume()
    res.end('done!')
  }

  function close(res) {
    res.resume()
    server.close(check)
  }

  function check() {
    t.equal(agent.errors.traceAggregator.errors.length, 1, 'should be 1 error')
    var error = agent.errors.traceAggregator.errors[0]
    t.equal(error[1], 'WebTransaction/NormalizedUri/*', 'should have correct transaction')
    t.equal(error[2], 'notice me!', 'should have right name')
    t.end()
  }
})
