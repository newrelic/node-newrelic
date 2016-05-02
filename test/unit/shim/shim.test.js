'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim')

describe('Shim', function() {
  var agent = null
  var shim = null

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    shim = new Shim(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  })

  describe('constructor', function() {
    it('should require an agent parameter')
  })

  describe('.defineProperty', function() {
    describe('with a value', function() {
      it('should create a non-writable property')
    })

    describe('with a function', function() {
      it('should create a getter')
    })
  })

  describe('.defineProperties', function() {
    it('should create all the properties specified')
  })

  describe('#FIRST through #LAST', function() {
    it('should be a non-writable property')
    it('should be an array index value')
  })

  describe('#WEB and #BG', function() {
    it('should be a non-writable property')
    it('should be transaction types')
  })

  describe('#agent', function() {
    it('should be a non-writable property')
    it('should be the agent handed to the constructor')
  })

  describe('#tracer', function() {
    it('should be a non-writable property')
    it('should be the tracer from the agent')
  })

  describe('#logger', function() {
    it('should be a non-writable property')
    it('should be a logger to use with the shim')
  })

  describe('#wrap', function() {
    it('should call the spec with the to-be-wrapped item')
    it('should pass items in the `args` parameter to the spec')

    describe('with no properties', function() {
      it('should wrap the first parameter')
      it('should wrap the first parameter when properties is `null`')
      it('should mark the first parameter as wrapped')
    })

    describe('with properties', function() {
      it('should accept a single property')
      it('should replace wrapped properties on the original object')
      it('should mark wrapped properties as such')
      it('should not mark unwrapped properties as wrapped')
    })
  })

  describe('#bindSegment', function() {
    it('should default to the current segment')
    it('should default `full` to false')

    describe('with no properties', function() {
      it('should wrap the first parameter if `property` is not given')
      it('should wrap the first parameter if `property` is `null`')
    })

    describe('wrapper', function() {
      it('should make the given segment active while executing')
      it('should not start and touch the segment if `full` is false')
    })
  })

  describe('#execute', function() {
  })

  describe('#wrapReturn', function() {
    it('should not wrap non-function objects')

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
      it('should execute the wrapped function')
      it('should call the spec with returned value')
      it('should invoke the spec in the context of the wrapped function')
      it('should pass items in the `args` parameter to the spec')
    })
  })

  describe('#record', function() {
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
      it('should create a segment')
      it('should execute the wrapped function')
    })
  })

  describe('#isWrapped', function() {
    describe('without a property', function() {
      it('should return true if the object was wrapped')
      it('should not error if the object is `null`')
    })

    describe('with a property', function() {
      it('should return true if the property was wrapped')
      it('should not error if the object is `null`')
      it('should not error if the property is `null`')
    })
  })

  describe('#unwrap', function() {
    it('should not error if `nodule` is `null`')
    it('should not error if the item is not wrapped')
    it('should fully unwrap nested wrappers')

    describe('with no properties', function() {
      it('should unwrap the first parameter')
    })

    describe('with properties', function() {
      it('should accept a single property')
      it('should unwrap each of the properties specified')
      it('should not error if a property is `null`')
    })
  })

  describe('#getSegment', function() {
    it('should return the segment a function is bound to')
    it('should return the current segment if the function is not bound')
    it('should return the current segment if no object is provided')
  })

  describe('#storeSegment', function() {
    it('should set a non-enumerable property on the object')
    it('should store the segment on the object')
    it('should default to the current segment')
    it('should not fail if the object is `null`')
  })

  describe('#bindCreateTransaction', function() {
    it('should not wrap non-function properties')

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
      it('should execute the wrapped function')
      it('should create a transaction with the correct type')
      it('should not create a nested transaction unless told to')
      it('should not nest transactions of the same type')
    })
  })

  describe('#bindCallbackSegment', function() {
    it('should wrap the callback in place')
    it('should work with an array and numeric index')
    it('should work with an object and a string index')
    it('should default the `parentSegment` to the current one')
    it('should not error if `args` is `null`')
    it('should not error if the callback does not exist')
    it('should not bind if the "callback" is not a function')
    it('should mark the callback as wrapped')
  })

  describe('#applySegment', function() {
    it('should call the function with the `context` and `args`')
    it('should return the function\'s return value')
    it('should make the segment active for the duration of execution')
    it('should start and touch the segment if `full` is `true`')
    it('should not change the active segment if `segment` is `null`')

    describe('when `func` throws an exception', function() {
      it('should not swallow the exception')
      it('should still return the active segment to the previous one')
      it('should still touch the segment if `full` is `true`')
    })
  })

  describe('#createSegment', function() {
    it('should create a segment with the correct name')
    it('should allow `recorder` to be omitted')
    it('should default to the current segment as the parent')
    it('should work with all parameters in an object')

    describe('when an `extras` object is provided', function() {
      it('should copy parameters provided into `segment.parameters`')
      it('should copy the `host` and `port` directly onto the segment')
    })
  })

  describe('#getName', function() {
    it('should return the `name` property of an object if it has one')
    it('should return "<anonymous>" if the object has no name')
  })

  describe('#isObject', function() {
    it('should detect if an item is an object')
  })

  describe('#isFunction', function() {
    it('should detect if an item is a function')
  })

  describe('#isString', function() {
    it('should detect if an item is a string')
  })

  describe('#isNumber', function() {
    it('should detect if an item is a number')
  })

  describe('#isBoolean', function() {
    it('should detect if an item is a boolean')
  })

  describe('#isArray', function() {
    it('should detect if an item is an array')
  })

  describe('#toArray', function() {
    it('should convert array-like objects into arrays')
  })

  describe('#normalizeIndex', function() {
    it('should return the index if it is already normal')
    it('should offset negative indexes from the end of the array')
    it('should return `null` for invalid indexes')
  })

  describe('#setInternalProperty', function() {
    it('should create a writable, non-enumerable value property')
    it('should not throw if the object has been frozen')
    it('should not throw if the property has been sealed')
  })

  describe('#defineProperty', function() {
    it('should create an enumerable, configurable property')
    it('should create a non-writable property when `value` is not a function')
    it('should create a getter when `value` is a function')
  })

  describe('#defineProperties', function() {
    it('should create properties for each key on `props`')
  })
})
