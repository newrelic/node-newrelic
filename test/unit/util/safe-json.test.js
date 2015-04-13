'use strict'

var safeJSON = require('../../../lib/util/safe-json')
var stringify = safeJSON.stringify
var stringifySync = safeJSON.stringifySync
var parse = safeJSON.parse
var chai = require('chai')
var expect = chai.expect

describe('stringifier', function stringifierTest() {
  it('should stringify objects', function(done) {
    var obj = {a: 1, b: 2}
    stringify(obj, function cb_stringify(err, stringified) {
      expect(err).equal(null)
      expect(stringified).equal('{"a":1,"b":2}')
      done()
    })
  })

  it('should fail gracefully on unstringifiable objects', function(done) {
    var badObj = {
      get testData () {
        throw new Exception()
      }
    }
    stringify(badObj, function cb_stringify(err, stringified){
      expect(err).not.equal(null)
      expect(stringified).equal('[UNPARSABLE OBJECT]')
      done()
    })
  })

  it('should invoke the callback synchronously', function() {
    var obj = {a: 1, b: 2}
    var shouldBeChanged = false

    stringify(obj, function cb_stringify(err, stringified) {
      expect(err).equal(null)
      expect(stringified).equal('{"a":1,"b":2}')
      shouldBeChanged = true
    })

    expect(shouldBeChanged).equal(true)
  })
})

describe('parser', function() {
  it('should parse json', function(done) {
    var json = '{"a":1,"b":2}'
    parse(json, function cb_parse(err, obj) {
      expect(err).equal(null)
      var keys = Object.keys(obj)
      expect(keys).deep.equal(['a', 'b'])
      expect(keys.map(function cb_map(key) {
          return obj[key]
      })).deep.equal([1, 2])
      done()
    })
  })

  it('should fail gracefully on unparsable objects', function(done) {
    var badJSON = 'this looks like poorly generated json'
    parse(badJSON, function cb_parse(err, obj) {
      expect(err).not.equal(null)
      expect(obj).equal(null)
      done()
    })
  })

  it('should invoke the callback synchronously', function() {
    var obj = {a: 1, b: 2}
    var shouldBeChanged = false

    stringify(obj, function cb_stringify(err, stringified) {
      expect(err).equal(null)
      expect(stringified).equal('{"a":1,"b":2}')
      shouldBeChanged = true
    })

    expect(shouldBeChanged).equal(true)
  })
})

describe('sync stringifier', function() {
  it('should stringify objects', function() {
    var obj = {a: 1, b: 2}
    expect(stringifySync(obj)).equal('{"a":1,"b":2}')
  })

  it('should fail gracefully on unstringifiable objects', function(){
    var badObj = {
      get testData () {
        throw new Exception()
      }
    }
    expect(stringifySync(badObj)).equal('[UNPARSABLE OBJECT]')
  })

  it('should fail gracefully on unstringifiable objects', function(){
    var badObj = {
      get testData () {
        throw new Exception()
      }
    }
    expect(stringifySync(badObj, 'On fail')).equal('On fail')
  })
})
