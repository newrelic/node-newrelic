'use strict'

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
    it('should capture a scrubbed version of the referer header', (done) => {
      const refererUrl = 'https://www.google.com/search/cats?scrubbed=false'

      const headers = {
        'referer': refererUrl
      }

      helper.runInTransaction(agent, (transaction) => {
        headerAttributes.collectRequestHeaders(headers, transaction)

        const attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        expect(attributes['request.headers.referer']).to.equal('https://www.google.com/search/cats')
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
          expect(attributes).to.have.property(
            'response.headers.contentType',
            'valid-type'
          )
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
          expect(attributes).to.have.property('response.headers.valid', 'header')
          expect(attributes).to.have.property(
            'response.headers.contentType',
            'valid-type'
          )
          done()
        })
      })
    })
  })
})
