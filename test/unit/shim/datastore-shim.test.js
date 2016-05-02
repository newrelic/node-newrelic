'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim')
var DatastoreShim = require('../../../lib/shim/datastore-shim')

describe('DatastoreShim', function() {
  var agent = null
  var shim = null

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    shim = new DatastoreShim(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  })

  it('should inherit from Shim')

  describe('constructor', function() {
    it('should require the `agent` parameter')
    it('should take an optional `datastoreId`')
  })

  describe('well-known datastores', function() {
    it('should be enumerated on the class and prototype')
  })

  describe('#logger', function() {
    it('should be a non-writable property')
    it('should be a logger to use with the shim')
  })

  describe('#setDatastore', function() {
    it('should accept the id of a well-known datastore')
    it('should create custom metric names if the `datastoreId` is a string')
  })

  describe('#recordOperation', function() {
    it('should not wrap non-function objects')
    it('should invoke the spec in the context of the wrapped function')

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given')
      it('should wrap the first parameter if `null` is given for properties')
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object')
      it('should mark wrapped properties as such')
      it('should not mark unwrapped properties as wrapped')
    })

    describe('wrapper', function() {
      it('should create a datastore operation metric')
      it('should execute the wrapped function')
    })
  })

  describe('#recordQuery', function() {
    it('should not wrap non-function objects')
    it('should invoke the spec in the context of the wrapped function')

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given')
      it('should wrap the first parameter if `null` is given for properties')
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object')
      it('should mark wrapped properties as such')
      it('should not mark unwrapped properties as wrapped')
    })

    describe('wrapper', function() {
      it('should create a datastore query metric')
      it('should execute the wrapped function')
    })
  })

  describe('#recordBatchQuery', function() {
    it('should not wrap non-function objects')
    it('should invoke the spec in the context of the wrapped function')

    describe('with no properties', function() {
      it('should wrap the first parameter if no properties are given')
      it('should wrap the first parameter if `null` is given for properties')
    })

    describe('with properties', function() {
      it('should replace wrapped properties on the original object')
      it('should mark wrapped properties as such')
      it('should not mark unwrapped properties as wrapped')
    })

    describe('wrapper', function() {
      it('should create a datastore batch query metric')
      it('should execute the wrapped function')
    })
  })

  describe('#parseQuery', function() {
    it('should parse a query string into a ParsedStatement')
  })
})
