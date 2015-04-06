var stringify = require('../../../lib/util/json-stringify-safer.js')
var chai = require('chai')
var expect = chai.expect


describe('stringifier', function() {
  it('should stringify objects', function() {
    var obj = {a: 1, b: 2}
    expect(stringify(obj)).equal('{"a":1,"b":2}')
  })

  it('should fail gracefully on unstringifiable objects', function(){
    var badObj = {
      get testData () {
        throw new Exception()
      }
    }
    expect(stringify(badObj)).equal('[UNPARSABLE OBJECT]')
  })

  it('should call the supplied function on failure', function(done){
    var badObj = {
      get testData () {
        throw new Exception()
      }
    }
    stringify(badObj, function(){
      done()
    })
  })
})
