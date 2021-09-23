/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const helper = require('../lib/agent_helper')
const expect = require('chai').expect
const headerAttributes = require('../../lib/header-attributes')

const DESTINATIONS = require('../../lib/config/attribute-filter').DESTINATIONS

describe('header-attributes', () => {
  let agent = null

  beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  describe('#collectRequestHeaders', () => {
    it('should be case insensitive when allow_all_headers is false', (done) => {
      agent.config.allow_all_headers = false
      const headers = {
        Accept: 'acceptValue'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes).to.have.property('request.headers.accept', 'acceptValue')
        expect(attributes).to.not.have.property('Accept')
        agent.config.allow_all_headers = true
        done()
      })
    })
    it('should strip `-` from headers', (done) => {
      const headers = {
        'content-type': 'valid-type'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes).to.have.property('request.headers.contentType', 'valid-type')
        expect(attributes).to.not.have.property('content-type')
        done()
      })
    })

    it('should lowercase first letter in headers', (done) => {
      const headers = {
        'Content-Type': 'valid-type'
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes).to.have.property('request.headers.contentType', 'valid-type')
        expect(attributes).to.not.have.property('Content-Type')
        expect(attributes).to.not.have.property('ContentType')
        done()
      })
    })

    it('should capture a scrubbed version of the referer header', (done) => {
      const refererUrl = 'https://www.google.com/search/cats?scrubbed=false'

      const headers = {
        referer: refererUrl
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)

        expect(attributes).to.have.property(
          'request.headers.referer',
          'https://www.google.com/search/cats'
        )

        done()
      })
    })

    describe('with allow_all_headers set to false', () => {
      it('should only collect allowed agent-specified headers', (done) => {
        agent.config.allow_all_headers = false

        const headers = {
          'invalid': 'header',
          'referer': 'valid-referer',
          'content-type': 'valid-type'
        }

        helper.runInTransaction(agent, (transaction) => {
          headerAttributes.collectRequestHeaders(headers, transaction)

          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          expect(attributes).to.not.have.property('request.headers.invalid')
          expect(attributes).to.have.property('request.headers.referer', 'valid-referer')
          expect(attributes).to.have.property('request.headers.contentType', 'valid-type')

          done()
        })
      })
    })

    describe('with allow_all_headers set to false', () => {
      it('should collect allowed headers as span attributes', (done) => {
        agent.config.allow_all_headers = false

        const headers = {
          'invalid': 'header',
          'referer': 'valid-referer',
          'content-type': 'valid-type'
        }

        helper.runInTransaction(agent, (transaction) => {
          headerAttributes.collectRequestHeaders(headers, transaction)

          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          expect(attributes).to.not.have.property('request.headers.invalid')
          expect(attributes).to.have.property('request.headers.referer', 'valid-referer')
          expect(attributes).to.have.property('request.headers.contentType', 'valid-type')

          const segment = transaction.agent.tracer.getSegment()
          const spanAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

          expect(spanAttributes).to.have.property('request.headers.referer', 'valid-referer')
          expect(spanAttributes).to.have.property('request.headers.contentType', 'valid-type')
          done()
        })
      })
    })

    describe('with allow_all_headers set to true', () => {
      it('should collect all headers not filtered by `exclude` rules', (done) => {
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
          expect(attributes).to.not.have.property('request.headers.x-filtered-out')
          expect(attributes).to.not.have.property('request.headers.xFilteredOut')
          expect(attributes).to.not.have.property('request.headers.XFilteredOut')
          expect(attributes).to.have.property('request.headers.valid', 'header')
          expect(attributes).to.have.property('request.headers.referer', 'valid-referer')
          expect(attributes).to.have.property('request.headers.contentType', 'valid-type')
          done()
        })
      })
    })
  })

  describe('#collectResponseHeaders', () => {
    describe('with allow_all_headers set to false', () => {
      it('should only collect allowed agent-specified headers', (done) => {
        agent.config.allow_all_headers = false

        const headers = {
          'invalid': 'header',
          'content-type': 'valid-type'
        }

        helper.runInTransaction(agent, (transaction) => {
          headerAttributes.collectResponseHeaders(headers, transaction)

          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          expect(attributes).to.not.have.property('response.headers.invalid')
          expect(attributes).to.have.property('response.headers.contentType', 'valid-type')
          done()
        })
      })
    })

    describe('with allow_all_headers set to true', () => {
      it('should collect all headers not filtered by `exclude` rules', (done) => {
        agent.config.allow_all_headers = true

        const headers = {
          'valid': 'header',
          'content-type': 'valid-type',
          'X-filtered-out': 'invalid'
        }

        helper.runInTransaction(agent, (transaction) => {
          headerAttributes.collectResponseHeaders(headers, transaction)

          const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
          expect(attributes).to.not.have.property('response.headers.x-filtered-out')
          expect(attributes).to.not.have.property('response.headers.xFilteredOut')
          expect(attributes).to.not.have.property('response.headers.XFilteredOut')
          expect(attributes).to.have.property('response.headers.valid', 'header')
          expect(attributes).to.have.property('response.headers.contentType', 'valid-type')
          done()
        })
      })
    })
  })
})
