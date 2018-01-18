'use strict'

var chai = require('chai')
var expect = chai.expect
var TraceAttributes = require('../../lib/transaction/trace/attributes')

describe('TraceAttributes', function() {
  var inst = null

  describe('#get', function() {
    it('gets attributes by destination, truncating values if necessary', function() {
      var longVal = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
        'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
        'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
      ].join(' ')

      inst = new TraceAttributes()
      inst.attributes = {
        valid: {
          destinations: [ 'test_destination' ],
          value: 50
        },
        tooLong: {
          destinations: [ 'test_destination' ],
          value: longVal
        },
        wrongDest: {
          destinations: [ 'some_other_destination' ],
          value: 'hello'
        }
      }

      expect(Buffer.byteLength(longVal)).to.be.above(255)
      var res = inst.get('test_destination')
      expect(res.valid).to.equal(50)
      expect(Buffer.byteLength(res.tooLong)).to.equal(255)
    })

    it('only returns attributes up to specified limit', function() {
      inst = new TraceAttributes({ limit: 2 })
      inst.attributes = {
        first: {
          destinations: [ 'test_destination' ],
          value: 'first'
        },
        second: {
          destinations: [ 'test_destination' ],
          value: 'second'
        },
        third: {
          destinations: [ 'test_destination' ],
          value: 'third'
        }
      }

      var res = inst.get('test_destination')
      expect(Object.keys(res).length).to.equal(2)
      expect(res.third).to.be.undefined()
    })

    it('returns attributes up to specified limit, regardless of position', function() {
      inst = new TraceAttributes({ limit: 2 })
      inst.attributes = {
        first: {
          destinations: [ 'different_destination' ],
          value: 'first'
        },
        second: {
          destinations: [ 'test_destination' ],
          value: 'second'
        },
        third: {
          destinations: [ 'test_destination' ],
          value: 'third'
        }
      }

      var res = inst.get('test_destination')
      expect(Object.keys(res).length).to.equal(2)
      expect(res.first).to.be.undefined()
    })
  })
})
