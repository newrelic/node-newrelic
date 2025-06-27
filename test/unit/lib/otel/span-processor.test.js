/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('#testlib/agent_helper.js')
const { ROOT_CONTEXT, SpanKind } = require('@opentelemetry/api')
const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const { RulesEngine } = require('#agentlib/otel/rules.js')
const SegmentSynthesizer = require('#agentlib/otel/segment-synthesis.js')
const SpanProcessor = require('#agentlib/otel/span-processor.js')

const tracer = new BasicTracerProvider().getTracer('default')

const ruleWithStaticAttributesJson = {
  name: 'StaticAttributes',
  type: 'db',
  matcher: {
    required_span_kinds: [
      'client'
    ],
    required_attribute_keys: [
      'db.system'
    ],
    attribute_conditions: {
      'db.system': ['test-db']
    }
  },
  attributes: [
    {
      key: 'db.system',
      target: 'segment',
      name: 'product'
    },
    {
      key: 'db.name',
      target: 'segment',
      name: 'database_name'
    },
    {
      key: 'server.address',
      target: 'segment',
      name: 'host',
      value: 'localhost'
    },
    {
      key: 'server.port',
      target: 'segment',
      name: 'port_path_or_id',
      value: '0'
    }
  ],
  segment: {
    collection: 'db.sql.table',
    operation: 'db.operation',
    statement: 'db.statement',
    type: 'db.system',
    name: {
      // eslint-disable-next-line no-template-curly-in-string
      template: 'Datastore/statement/${type}/${collection}/${operation}'
    }
  }
}

test.beforeEach(ctx => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()

  ctx.nr.logs = {
    debug: []
  }
  ctx.nr.logger = {
    debug(...args) {
      ctx.nr.logs.debug.push(args)
    }
  }

  ctx.nr.synthesizer = new SegmentSynthesizer(ctx.nr.agent, { logger: ctx.nr.logger })
  ctx.nr.processor = new SpanProcessor(ctx.nr.agent, { logger: ctx.nr.logger })
})

test.afterEach(ctx => [
  helper.unloadAgent(ctx.nr.agent)
])

test('maps static attributes', (t, end) => {
  const { agent, processor, synthesizer } = t.nr

  helper.runInTransaction(agent, tx => {
    const span = tracer.startSpan('test-span', { kind: SpanKind.CLIENT }, ROOT_CONTEXT)
    span.setAttribute('db.system', 'test-db')
    span.setAttribute('db.name', 'foo')
    span.setAttribute('db.sql.table', 'table1')
    span.setAttribute('db.operation', 'select')
    span.setAttribute('db.statement', 'select * from table1')
    span.end()

    synthesizer.engine = new RulesEngine({ rulesJson: [ruleWithStaticAttributesJson] })
    const { segment, rule } = synthesizer.synthesize(span)
    processor.mapAttributes({ segment, span, rule, transaction: tx })

    tx.end()
    assert.ok(tx)

    const augmentedSegment = tx.trace.segments.root.children[0]?.segment
    const attrs = augmentedSegment.attributes.attributes
    assert.ok(augmentedSegment)
    assert.equal(augmentedSegment.name, 'Datastore/statement/test-db/table1/select')
    assert.equal(attrs.database_name.value, 'foo')
    assert.equal(attrs['db.operation'].value, 'select')
    assert.equal(attrs['db.sql.table'].value, 'table1')
    assert.equal(attrs['db.statement'].value, 'select * from table1')
    assert.equal(attrs.product.value, 'test-db')

    const metrics = tx.metrics.unscoped
    const expectedMetrics = [
      'Datastore/operation/test-db/select',
      'Datastore/statement/test-db/table1/select',
      'Datastore/instance/test-db/localhost/0'
    ]
    for (const expectedMetric of expectedMetrics) {
      assert.equal(metrics[expectedMetric]?.callCount, 1, `should have ${expectedMetric} metric`)
    }

    end()
  })
})
