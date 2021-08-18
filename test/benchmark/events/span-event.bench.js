/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const helper = require('../../lib/agent_helper')
const SpanEvent = require('../../../lib/spans/span-event')

const suite = benchmark.createBenchmark({ name: 'SpanEvent' })
let segment = null

suite.add({
  name: 'from generic segment',
  agent: {},
  before: (agent) => {
    segment = makeSegment(agent)
    segment.name = 'some random segment'
  },
  fn: () => {
    return SpanEvent.fromSegment(segment)
  }
})

suite.add({
  name: 'from external segment',
  agent: {},
  before: (agent) => {
    segment = makeSegment(agent)
    segment.name = 'External/www.foobar.com/'
  },
  fn: () => {
    return SpanEvent.fromSegment(segment)
  }
})

suite.add({
  name: 'from db segment',
  agent: {},
  before: (agent) => {
    segment = makeSegment(agent)
    segment.name = 'Datastore/statement/SELECT'
  },
  fn: () => {
    return SpanEvent.fromSegment(segment)
  }
})

suite.run()

function makeSegment(agent) {
  const s = helper.runInTransaction(agent, (tx) => tx.trace.root)
  s.addAttribute('foo', 'bar')
  s.addAttribute('request.headers.x-customer-header', 'some header value')
  s.addAttribute('library', 'my great library')
  s.addAttribute('url', 'http://my-site.com')
  s.addAttribute('procedure', 'GET')
  s.addAttribute('product', 'BestDB')
  s.addAttribute('sql', 'SELECT * FROM the_best')
  s.addAttribute('database_name', 'users_db')
  s.addAttribute('host', '123.123.123.123')
  s.addAttribute('port_path_or_id', '3306')
  s.end()
  s.transaction.end()

  return s
}
