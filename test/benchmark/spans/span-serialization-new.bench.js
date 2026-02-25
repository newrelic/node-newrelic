'use strict'
const helper = require('#testlib/agent_helper.js')
const test = require('node:test')
const SPANS = process.env.SPANS ?? 1000


test('span serialization', (t) => {
  const agent = helper.loadMockedAgent()
  helper.runInTransaction(agent, (tx) => {
    for (let i = 0; i < SPANS; i++) {
      const segment = agent.tracer.createSegment({
        name: 'testSegment',
        transaction: tx,
        parent: tx.trace.root
      })
      segment.start()
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
    }
    tx.end()
    const payload = agent.spanEventAggregator._toPayloadSync()
    debugger
    const serialized = JSON.stringify(payload)
    debugger
  })

})



