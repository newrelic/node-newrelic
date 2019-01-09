'use strict'

var chai   = require('chai')
var expect = chai.expect
var parse  = require('../../../lib/collector/key-parser').parseKey


describe('collector license key parser', function() {
  it('should return the region prefix when a region is detected', function() {
    var testKey = 'eu01xx66c637a29c3982469a3fe8d1982d002c4a'
    var region = parse(testKey)
    expect(region).to.equal('eu01')
  })
  it('should return null when a region is not detected', function() {
    var testKey = '08a2ad66c637a29c3982469a3fe8d1982d002c4a'
    var region = parse(testKey)
    expect(region).to.be.null
  })
})
