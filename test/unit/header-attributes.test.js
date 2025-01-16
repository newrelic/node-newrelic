/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../lib/agent_helper')
const headerAttributes = require('../../lib/header-attributes')

const { DESTINATIONS } = require('../../lib/config/attribute-filter')

function beforeEach(ctx) {
  ctx.nr = {}

  const config = {
    attributes: {
      exclude: [
        'request.headers.cookie',
        'request.headers.authorization',
        'request.headers.proxyAuthorization',
        'request.headers.setCookie*',
        'request.headers.x*',
        'response.headers.cookie',
        'response.headers.authorization',
        'response.headers.proxyAuthorization',
        'response.headers.setCookie*',
        'response.headers.x*'
      ]
    }
  }
  ctx.nr.agent = helper.loadMockedAgent(config)
}

function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
}

test('#collectRequestHeaders', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('should be case insensitive when allow_all_headers is false', (t, end) => {
    const { agent } = t.nr
    agent.config.allow_all_headers = false
    const headers = {
      Accept: 'acceptValue'
    }

    helper.runInTransaction(agent, (transaction) => {
      headerAttributes.collectRequestHeaders(headers, transaction)

      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(attributes['request.headers.accept'], 'acceptValue')
      assert.equal(attributes.Accept, undefined)
      agent.config.allow_all_headers = true
      end()
    })
  })

  await t.test('should strip `-` from headers', (t, end) => {
    const { agent } = t.nr
    const headers = {
      'content-type': 'valid-type'
    }

    helper.runInTransaction(agent, (transaction) => {
      headerAttributes.collectRequestHeaders(headers, transaction)

      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(attributes['request.headers.contentType'], 'valid-type')
      assert.equal(attributes['content-type'], undefined)
      end()
    })
  })

  await t.test('should replace repeating non-word characters', (t, end) => {
    const { agent } = t.nr
    agent.config.allow_all_headers = true
    const headers = {
      'foo-bar--baz': 'valid-type'
    }

    helper.runInTransaction(agent, (transaction) => {
      headerAttributes.collectRequestHeaders(headers, transaction)

      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_COMMON)
      assert.equal(attributes['request.headers.fooBarBaz'], 'valid-type')
      assert.equal(attributes['foo-bar--baz'], undefined)
      end()
    })
  })

  await t.test('should lowercase first letter in headers', (t, end) => {
    const { agent } = t.nr
    const headers = {
      'Content-Type': 'valid-type'
    }

    helper.runInTransaction(agent, (transaction) => {
      headerAttributes.collectRequestHeaders(headers, transaction)

      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(attributes['request.headers.contentType'], 'valid-type')
      assert.equal(attributes['Content-Type'], undefined)
      assert.equal(attributes.ContentType, undefined)
      end()
    })
  })

  await t.test('should capture a scrubbed version of the referer header', (t, end) => {
    const { agent } = t.nr
    const refererUrl = 'https://www.google.com/search/cats?scrubbed=false'

    const headers = {
      referer: refererUrl
    }

    helper.runInTransaction(agent, (transaction) => {
      headerAttributes.collectRequestHeaders(headers, transaction)

      const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)

      assert.equal(attributes['request.headers.referer'], 'https://www.google.com/search/cats')

      end()
    })
  })

  await t.test(
    'with allow_all_headers set to false should only collect allowed agent-specified headers',
    (t, end) => {
      const { agent } = t.nr
      agent.config.allow_all_headers = false

      const headers = {
        invalid: 'header',
        referer: 'valid-referer',
        'content-type': 'valid-type'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        assert.equal(attributes['request.headers.invalid'], undefined)
        assert.equal(attributes['request.headers.referer'], 'valid-referer')
        assert.equal(attributes['request.headers.contentType'], 'valid-type')

        end()
      })
    }
  )

  await t.test(
    'with allow_all_headers set to false should collect allowed headers as span attributes',
    (t, end) => {
      const { agent } = t.nr
      agent.config.allow_all_headers = false

      const headers = {
        invalid: 'header',
        referer: 'valid-referer',
        'content-type': 'valid-type'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        assert.equal(attributes['request.headers.invalid'], undefined)
        assert.equal(attributes['request.headers.referer'], 'valid-referer')
        assert.equal(attributes['request.headers.contentType'], 'valid-type')

        const segment = transaction.agent.tracer.getSegment()
        const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

        assert.equal(spanAttributes['request.headers.referer'], 'valid-referer')
        assert.equal(spanAttributes['request.headers.contentType'], 'valid-type')
        end()
      })
    }
  )

  await t.test(
    'with allow_all_headers set to true should collect all headers not filtered by `exclude` rules',
    (t, end) => {
      const { agent } = t.nr
      agent.config.allow_all_headers = true

      const headers = {
        valid: 'header',
        referer: 'valid-referer',
        'content-type': 'valid-type',
        'X-filtered-out': 'invalid'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        assert.equal(attributes['request.headers.x-filtered-out'], undefined)
        assert.equal(attributes['request.headers.xFilteredOut'], undefined)
        assert.equal(attributes['request.headers.XFilteredOut'], undefined)
        assert.equal(attributes['request.headers.valid'], 'header')
        assert.equal(attributes['request.headers.referer'], 'valid-referer')
        assert.equal(attributes['request.headers.contentType'], 'valid-type')
        end()
      })
    }
  )
})

test('#collectResponseHeaders', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test(
    'with allow_all_headers set to false should only collect allowed agent-specified headers',
    (t, end) => {
      const { agent } = t.nr
      agent.config.allow_all_headers = false

      const headers = {
        invalid: 'header',
        'content-type': 'valid-type'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectResponseHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        assert.equal(attributes['response.headers.invalid'], undefined)
        assert.equal(attributes['response.headers.contentType'], 'valid-type')
        end()
      })
    }
  )

  await t.test(
    'with allow_all_headers set to true should collect all headers not filtered by `exclude` rules',
    (t, end) => {
      const { agent } = t.nr
      agent.config.allow_all_headers = true

      const headers = {
        valid: 'header',
        'content-type': 'valid-type',
        'X-filtered-out': 'invalid'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectResponseHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        assert.equal(attributes['response.headers.x-filtered-out'], undefined)
        assert.equal(attributes['response.headers.xFilteredOut'], undefined)
        assert.equal(attributes['response.headers.XFilteredOut'], undefined)
        assert.equal(attributes['response.headers.valid'], 'header')
        assert.equal(attributes['response.headers.contentType'], 'valid-type')
        end()
      })
    }
  )
})
