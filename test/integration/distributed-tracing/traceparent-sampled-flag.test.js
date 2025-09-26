/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable sonarjs/no-identical-functions */

const test = require('node:test')
const assert = require('node:assert')

const helper = require('#testlib/agent_helper.js')

const TRACE_ID = '0af7651916cd43dd8448eb211c80319c'
const SPAN_ID = 'b9c7c989f97918e1'

// All agent configurations in this test suite _must_ use this configuration
// as their baseline. We need to disable undici instrumentation so that we
// can use it to issue HTTP requests that will _not_ be instrumented by the
// agent. If our client requests are instrumented by the agent, we will not be
// able to force the correct traceparent/tracestate headers.
const defaultAgentConfig = {
  instrumentation: {
    undici: { enabled: false }
  }
}

test.beforeEach((ctx) => {
  ctx.nr = {}
})

test.afterEach((ctx) => {
  ctx.nr.server.close()
  if (ctx.nr.agent) {
    helper.unloadAgent(ctx.nr.agent)
  }
})

test('remote_parent_sampled: always_on', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'always_on'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { host, port } = t.nr

  const result = await doRequest({ host, port })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, true)
    assert.equal(tx.priority, 2.0)
  }
})

test('remote_parent_sampled: always_off', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'always_off'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { host, port } = t.nr

  const result = await doRequest({ host, port })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, false)
    assert.equal(tx.priority, 0)
  }
})

test('remote_parent_sampled: default', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'default'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { host, port } = t.nr

  const result = await doRequest({ host, port })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, null)
    assert.equal(tx.priority, null)
  }
})

test('remote_parent_sampled: default, remote_parent_not_sampled: always_on (flag true)', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'default',
        remote_parent_not_sampled: 'always_on'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { host, port } = t.nr

  const result = await doRequest({ host, port })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, null)
    assert.equal(tx.priority, null)
  }
})

test('remote_parent_sampled: default, remote_parent_not_sampled: always_on (flag false)', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'default',
        remote_parent_not_sampled: 'always_on'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { host, port } = t.nr

  const result = await doRequest({ host, port, traceparent: `00-${TRACE_ID}-${SPAN_ID}-00` })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, true)
    assert.equal(tx.priority, 2.0)
  }
})

test('remote_parent_sampled: default, remote_parent_not_sampled: always_off (flag true)', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'default',
        remote_parent_not_sampled: 'always_off'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { host, port } = t.nr

  const result = await doRequest({ host, port })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, null)
    assert.equal(tx.priority, null)
  }
})

test('remote_parent_sampled: default, remote_parent_not_sampled: always_off (flag false)', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'default',
        remote_parent_not_sampled: 'always_off'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { host, port } = t.nr

  const result = await doRequest({ host, port, traceparent: `00-${TRACE_ID}-${SPAN_ID}-00` })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, false)
    assert.equal(tx.priority, 0)
  }
})

test('remote_parent_sampled: default, remote_parent_not_sampled: default (flag true)', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'default',
        remote_parent_not_sampled: 'default'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { host, port } = t.nr

  const result = await doRequest({ host, port })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, null)
    assert.equal(tx.priority, null)
  }
})

test('remote_parent_sampled: default, remote_parent_not_sampled: default (flag false)', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'default',
        remote_parent_not_sampled: 'default'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { host, port } = t.nr

  const result = await doRequest({ host, port, traceparent: `00-${TRACE_ID}-${SPAN_ID}-00` })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, null)
    assert.equal(tx.priority, null)
  }
})

test('remote_parent_sampled: default, remote_parent_not_sampled: default (flag false, intrinsics available)', async (t) => {
  const agentConfig = Object.assign({}, defaultAgentConfig, {
    distributed_tracing: {
      sampler: {
        remote_parent_sampled: 'default',
        remote_parent_not_sampled: 'default'
      }
    }
  })
  await beforeEach(t.nr, agentConfig, validator)

  const { agent, host, port } = t.nr
  agent.config.account_id = '33'
  agent.config.trusted_account_key = '33'

  const result = await doRequest({
    host,
    port,
    traceparent: `00-${TRACE_ID}-${SPAN_ID}-00`,
    tracestate: `33@nr=0-0-33-2827902-${SPAN_ID}-e8b91a159289ff74-1-1.23456-1518469636035`
  })
  assert.equal(result, 'ok')

  function validator(tx) {
    assert.equal(tx.acceptedDistributedTrace, true)
    assert.equal(tx.traceId, TRACE_ID)
    assert.equal(tx.parentSpanId, SPAN_ID)
    assert.equal(tx.sampled, true)
    assert.equal(tx.priority, 1.23456)
  }
})

/**
 *
 * @param {object} ctx The `t.nr` object that we use as local test context.
 * @param {object} agentConfig The agent configuration to use for the test.
 * @param {function} validator The function to validate the transaction.
 * @returns {Promise<void>}
 */
async function beforeEach(
  ctx,
  agentConfig = defaultAgentConfig,
  validator = () => assert.ok(true)
) {
  ctx.agent = helper.instrumentMockedAgent(agentConfig)
  ctx.http = require('node:http')

  const { server, host, port } = await createServer(ctx.http, ctx.agent, validator)
  ctx.server = server
  ctx.host = host
  ctx.port = port
}

async function createServer(http, agent, validator) {
  const server = http.createServer((req, res) => {
    try {
      const tx = agent.getTransaction()
      validator(tx)
    } finally {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('"ok"')
    }
  })

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => {
      if (error) return reject(error)
      resolve()
    })
  })

  return {
    server,
    host: server.address().address,
    port: server.address().port
  }
}

async function doRequest({
  host,
  port,
  traceparent = `00-${TRACE_ID}-${SPAN_ID}-01`,
  tracestate = 'foo=bar'
}) {
  const params = {
    path: '/',
    method: 'GET',
    headers: {
      traceparent,
      tracestate
    }
  }
  const res = await fetch(`http://${host}:${port}`, params)
  return res.json()
}
