'use strict'

var safeJSON = require('../../../lib/util/safe-json')
var parse = safeJSON.parse
var chai = require('chai')
var expect = chai.expect

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
})
