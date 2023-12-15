/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const helper = require('../lib/agent_helper')
const headerAttributes = require('../../lib/header-attributes')

const DESTINATIONS = require('../../lib/config/attribute-filter').DESTINATIONS
function beforeEach(t) {
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
  t.context.agent = helper.loadMockedAgent(config)
}

function afterEach(t) {
  helper.unloadAgent(t.context.agent)
}

tap.test('header-attributes', (t) => {
  t.autoend()

  t.test('#collectRequestHeaders', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should be case insensitive when allow_all_headers is false', (t) => {
      const { agent } = t.context
      agent.config.allow_all_headers = false
      const headers = {
        Accept: 'acceptValue'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        t.equal(attributes['request.headers.accept'], 'acceptValue')
        t.notOk(attributes.Accept)
        agent.config.allow_all_headers = true
        t.end()
      })
    })
    t.test('should strip `-` from headers', (t) => {
      const { agent } = t.context
      const headers = {
        'content-type': 'valid-type'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        t.equal(attributes['request.headers.contentType'], 'valid-type')
        t.notOk(attributes['content-type'])
        t.end()
      })
    })

    t.test('should lowercase first letter in headers', (t) => {
      const { agent } = t.context
      const headers = {
        'Content-Type': 'valid-type'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        t.equal(attributes['request.headers.contentType'], 'valid-type')
        t.notOk(attributes['Content-Type'])
        t.notOk(attributes.ContentType)
        t.end()
      })
    })

    t.test('should capture a scrubbed version of the referer header', (t) => {
      const { agent } = t.context
      const refererUrl = 'https://www.google.com/search/cats?scrubbed=false'

      const headers = {
        referer: refererUrl
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)

        t.equal(attributes['request.headers.referer'], 'https://www.google.com/search/cats')

        t.end()
      })
    })

    t.test(
      'with allow_all_headers set to false should only collect allowed agent-specified headers',
      (t) => {
        const { agent } = t.context
        agent.config.allow_all_headers = false

        const headers = {
          'invalid': 'header',
          'referer': 'valid-referer',
          'content-type': 'valid-type'
        }

        helper.runInTransaction(agent, (transaction) => {
          headerAttributes.collectRequestHeaders(headers, transaction)

          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          t.notOk(attributes['request.headers.invalid'])
          t.equal(attributes['request.headers.referer'], 'valid-referer')
          t.equal(attributes['request.headers.contentType'], 'valid-type')

          t.end()
        })
      }
    )

    t.test(
      'with allow_all_headers set to false should collect allowed headers as span attributes',
      (t) => {
        const { agent } = t.context
        agent.config.allow_all_headers = false

        const headers = {
          'invalid': 'header',
          'referer': 'valid-referer',
          'content-type': 'valid-type'
        }

        helper.runInTransaction(agent, (transaction) => {
          headerAttributes.collectRequestHeaders(headers, transaction)

          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          t.notOk(attributes['request.headers.invalid'])
          t.equal(attributes['request.headers.referer'], 'valid-referer')
          t.equal(attributes['request.headers.contentType'], 'valid-type')

          const segment = transaction.agent.tracer.getSegment()
          const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          t.equal(spanAttributes['request.headers.referer'], 'valid-referer')
          t.equal(spanAttributes['request.headers.contentType'], 'valid-type')
          t.end()
        })
      }
    )

    t.test(
      'with allow_all_headers set to true should collect all headers not filtered by `exclude` rules',
      (t) => {
        const { agent } = t.context
        agent.config.allow_all_headers = true

        const headers = {
          'valid': 'header',
          'referer': 'valid-referer',
          'content-type': 'valid-type',
          'X-filtered-out': 'invalid'
        }

        helper.runInTransaction(agent, (transaction) => {
          headerAttributes.collectRequestHeaders(headers, transaction)

          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          t.notOk(attributes['request.headers.x-filtered-out'])
          t.notOk(attributes['request.headers.xFilteredOut'])
          t.notOk(attributes['request.headers.XFilteredOut'])
          t.equal(attributes['request.headers.valid'], 'header')
          t.equal(attributes['request.headers.referer'], 'valid-referer')
          t.equal(attributes['request.headers.contentType'], 'valid-type')
          t.end()
        })
      }
    )
  })

  t.test('#collectResponseHeaders', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test(
      'with allow_all_headers set to false should only collect allowed agent-specified headers',
      (t) => {
        const { agent } = t.context
        agent.config.allow_all_headers = false

        const headers = {
          'invalid': 'header',
          'content-type': 'valid-type'
        }

        helper.runInTransaction(agent, (transaction) => {
          headerAttributes.collectResponseHeaders(headers, transaction)

          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          t.notOk(attributes['response.headers.invalid'])
          t.equal(attributes['response.headers.contentType'], 'valid-type')
          t.end()
        })
      }
    )

    t.test(
      'with allow_all_headers set to true should collect all headers not filtered by `exclude` rules',
      (t) => {
        const { agent } = t.context
        agent.config.allow_all_headers = true

        const headers = {
          'valid': 'header',
          'content-type': 'valid-type',
          'X-filtered-out': 'invalid'
        }

        helper.runInTransaction(agent, (transaction) => {
          headerAttributes.collectResponseHeaders(headers, transaction)

          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          t.notOk(attributes['response.headers.x-filtered-out'])
          t.notOk(attributes['response.headers.xFilteredOut'])
          t.notOk(attributes['response.headers.XFilteredOut'])
          t.equal(attributes['response.headers.valid'], 'header')
          t.equal(attributes['response.headers.contentType'], 'valid-type')
          t.end()
        })
      }
    )
  })
})
