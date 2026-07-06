/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const semver = require('semver')
const helper = require('#testlib/agent_helper.js')
const { wrapPromise } = require('#agentlib/subscribers/utils.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

// Builds a minimal subscriber-like `this` for `wrapPromise`. It only needs a
// tracer (via `agent`) and a `channel.asyncEnd.publish` to forward to.
function makeSubscriber(agent, published) {
  return {
    agent,
    channel: {
      asyncEnd: {
        publish(data) {
          published.push(data)
          agent.tracer.getSegment()?.touch()
        }
      }
    }
  }
}

test('returns non-thenable results untouched', function (t) {
  const { agent } = t.nr
  const sub = makeSubscriber(agent, [])
  assert.equal(wrapPromise.call(sub, { result: 42 }), 42)
  assert.equal(wrapPromise.call(sub, undefined), undefined)
})

test('publishes asyncEnd with the result when the promise resolves', async function (t) {
  const { agent } = t.nr
  const published = []
  const sub = makeSubscriber(agent, published)

  await helper.runInTransaction(agent, async function (tx) {
    const segment = agent.tracer.getSegment()
    let resolveFn
    const promise = new Promise((resolve) => {
      resolveFn = resolve
    })
    const data = { result: promise, segment }
    wrapPromise.call(sub, data)
    resolveFn('ok')
    await promise

    assert.equal(published.length, 1, 'asyncEnd should be published once')
    assert.equal(published[0].result, 'ok', 'settled value should be stored on data')
    tx.end()
  })
})

test('publishes asyncEnd with the error when the promise rejects', async function (t) {
  const { agent } = t.nr
  const published = []
  const sub = makeSubscriber(agent, published)
  const error = new Error('boom')

  await helper.runInTransaction(agent, async function (tx) {
    const promise = Promise.reject(error)
    const data = { result: promise }
    wrapPromise.call(sub, data)
    await promise.catch(() => {})

    assert.equal(published.length, 1, 'asyncEnd should be published once')
    assert.equal(published[0].error, error, 'rejection should be stored on data')
    tx.end()
  })
})

// see: https://github.com/newrelic/node-newrelic/issues/4092.
// `wrapPromise` attaches a link to a promise that publishes `asyncEnd` (touching the
// segment) when a command promise settles. The propagation must not pin the async
// context frame, otherwise a command promise the application never awaits to
// completion keeps the segment (and its transaction) alive forever, thus leaks memory because it cannot be freed.
//
// This test is only valid where AsyncContextFrame is enabled(Node's default from v24),
// so they are skipped below v24 where a held pending promise pins the async
// context regardless of the agent. See the tracer suite for the same rationale.
test('does not retain the segment for a pending command promise', { skip: semver.lt(process.version, '24.0.0') }, async function (t) {
  const { agent } = t.nr
  const tracer = agent.tracer
  const sub = makeSubscriber(agent, [])

  const v8 = require('node:v8')
  const vm = require('node:vm')
  v8.setFlagsFromString('--expose-gc')
  const gc = vm.runInNewContext('gc')
  v8.setFlagsFromString('--no-expose-gc')

  async function collect() {
    for (let i = 0; i < 30; i++) {
      gc()
      await new Promise((resolve) => setImmediate(resolve))
    }
  }

  const held = []
  let ref
  helper.runInTransaction(agent, function (tx) {
    tracer.addSegment('command', null, tracer.getSegment(), false, function task() {
      ref = new WeakRef(tracer.getSegment())
      const promise = new Promise(() => {})
      held.push(promise)
      wrapPromise.call(sub, { result: promise })
    })
    tx.end()
  })

  await collect()

  assert.equal(held.length, 1, 'application still holds the pending promise')
  assert.equal(ref.deref(), undefined, 'segment should be collected even though the command promise never settled')
})
