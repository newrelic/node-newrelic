/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const ConglomerateShim = require('../../../lib/shim/conglomerate-shim')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const {expect} = require('chai')
const helper = require('../../lib/agent_helper')
const MessageShim = require('../../../lib/shim/message-shim')
const PromiseShim = require('../../../lib/shim/promise-shim')
const Shim = require('../../../lib/shim/shim')
const TransactionShim = require('../../../lib/shim/transaction-shim')
const WebFrameworkShim = require('../../../lib/shim/webframework-shim')


describe('ConglomerateShim', () => {
  let agent = null
  let shim = null

  beforeEach(() => {
    agent = helper.loadMockedAgent()
    shim = new ConglomerateShim(agent, 'test-module')
  })

  afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  })

  describe('constructor', () => {
    it('should require an agent parameter', () => {
      expect(() => new ConglomerateShim())
        .to.throw(Error, /^Shim must be initialized with .*? agent/)
    })
    it('should require a module name parameter', () => {
      expect(() => new ConglomerateShim(agent))
        .to.throw(Error, /^Shim must be initialized with .*? module name/)
    })
  })

  describe('module type properties', () => {
    it('should exist for each shim type', () => {
      expect(shim).to.have.property('GENERIC', 'generic')
      expect(shim).to.have.property('DATASTORE', 'datastore')
      expect(shim).to.have.property('MESSAGE', 'message')
      expect(shim).to.have.property('PROMISE', 'promise')
      expect(shim).to.have.property('TRANSACTION', 'transaction')
      expect(shim).to.have.property('WEB_FRAMEWORK', 'web-framework')
    })
  })

  describe('#makeSpecializedShim', () => {
    it('should construct a new shim', () => {
      expect(shim.makeSpecializedShim(shim.GENERIC, 'foobar'))
        .to.be.an.instanceOf(Shim)
        .and.not.equal(shim)
    })

    describe('new shim', () => {
      it('should be an instance of the correct class', () => {
        expect(shim.makeSpecializedShim(shim.GENERIC, 'foobar'))
          .to.be.an.instanceOf(Shim)
        expect(shim.makeSpecializedShim(shim.DATASTORE, 'foobar'))
          .to.be.an.instanceOf(DatastoreShim)
        expect(shim.makeSpecializedShim(shim.MESSAGE, 'foobar'))
          .to.be.an.instanceOf(MessageShim)
        expect(shim.makeSpecializedShim(shim.PROMISE, 'foobar'))
          .to.be.an.instanceOf(PromiseShim)
        expect(shim.makeSpecializedShim(shim.TRANSACTION, 'foobar'))
          .to.be.an.instanceOf(TransactionShim)
        expect(shim.makeSpecializedShim(shim.WEB_FRAMEWORK, 'foobar'))
          .to.be.an.instanceOf(WebFrameworkShim)
      })
    })
  })
})
