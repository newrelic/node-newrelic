/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const helper = require('#testlib/agent_helper.js')
const SpanEvent = require('#agentlib/spans/span-event.js')

const suite = benchmark.createBenchmark({ name: 'SpanEvent' })
let segment = null
let transaction = null

suite.add({
  name: 'from generic segment',
  agent: {},
  before: (agent) => {
    ;({ segment, transaction } = makeSegment(agent))
    segment.name = 'some random segment'
  },
  fn: () => SpanEvent.fromSegment({ segment, transaction })
})

suite.add({
  name: 'from external segment',
  agent: {},
  before: (agent) => {
    ;({ segment, transaction } = makeSegment(agent))
    segment.name = 'External/www.foobar.com/'
  },
  fn: () => SpanEvent.fromSegment({ segment, transaction })
})

suite.add({
  name: 'from db segment',
  agent: {},
  before: (agent) => {
    ;({ segment, transaction } = makeSegment(agent))
    segment.name = 'Datastore/statement/SELECT'
  },
  fn: () => SpanEvent.fromSegment({ segment, transaction })
})

suite.run()

function makeSegment(agent) {
  const transaction = helper.runInTransaction(agent, (tx) => tx)
  const segment = transaction.trace.root
  segment.addAttribute('foo', 'bar')
  segment.addAttribute('request.headers.x-customer-header', 'some header value')
  segment.addAttribute('library', 'my great library')
  segment.addAttribute('url', 'http://my-site.com')
  segment.addAttribute('procedure', 'GET')
  segment.addAttribute('product', 'BestDB')
  segment.addAttribute('sql', 'SELECT * FROM the_best')
  segment.addAttribute('database_name', 'users_db')
  segment.addAttribute('host', '123.123.123.123')
  segment.addAttribute('port_path_or_id', '3306')
  segment.end()
  transaction.end()

  return { segment, transaction }
}
