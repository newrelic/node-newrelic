'use strict'

var NameState = require('../../lib/transaction/name-state.js')
var expect = require('chai').expect

describe('NameState', function() {
  it('should handle basic naming', function() {
    var state = new NameState('Nodejs', 'GET', '/', 'path1')
    state.appendPath('path2')
    expect(state.getName()).to.equal('Nodejs/GET//path1/path2')
  })

  it('should handle piece-wise naming', function() {
    var state = new NameState(null, null, null, null)
    state.setPrefix('Nodejs')
    state.setVerb('GET')
    state.setDelimiter('/')
    state.appendPath('path1')
    state.appendPath('path2')
    state.appendPath('path3')
    expect(state.getName()).to.equal('Nodejs/GET//path1/path2/path3')
  })

  it('should handle missing components', function() {
    var state = new NameState('Nodejs', null, null, 'path1')
    expect(state.getName()).to.equal('Nodejs/path1')

    state = new NameState('Nodejs', null, '/', 'path1')
    expect(state.getName()).to.equal('Nodejs//path1')

    state = new NameState(null, null, null, 'path1')
    expect(state.getName()).to.equal('/path1')

    state = new NameState('Nodejs', null, null, null)
    expect(state.getName()).to.equal(null)
  })

  it('should delete the name when reset', function() {
    var state = new NameState('Nodejs', 'GET', '/', 'path1')
    expect(state.getName()).to.equal('Nodejs/GET//path1')

    state.reset()
    expect(state.getName()).to.equal(null)
  })

  it('should handle regex paths', function() {
    var state = new NameState('Nodejs', 'GET', '/', [])
    state.appendPath(new RegExp('regex1'))
    state.appendPath('path1')
    state.appendPath(/regex2/)
    state.appendPath('path2')

    expect(state.getName()).to.equal('Nodejs/GET//regex1/path1/regex2/path2')
  })
})
