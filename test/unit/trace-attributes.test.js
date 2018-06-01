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
          destinations: 0x01,
          value: 50
        },
        tooLong: {
          destinations: 0x01,
          value: longVal
        },
        wrongDest: {
          destinations: 0x08,
          value: 'hello'
        }
      }

      expect(Buffer.byteLength(longVal)).to.be.above(255)
      var res = inst.get(0x01)
      expect(res.valid).to.equal(50)
      expect(Buffer.byteLength(res.tooLong)).to.equal(255)
    })

    it('only returns attributes up to specified limit', function() {
      inst = new TraceAttributes({ limit: 2 })
      inst.attributes = {
        first: {
          destinations: 0x01,
          value: 'first'
        },
        second: {
          destinations: 0x01,
          value: 'second'
        },
        third: {
          destinations: 0x01,
          value: 'third'
        }
      }

      var res = inst.get(0x01)
      expect(Object.keys(res).length).to.equal(2)
      expect(res.third).to.be.undefined
    })

    it('only includes primitive attribute value types', function() {
      inst = new TraceAttributes({ limit: 10 })
      inst.attributes = {
        first: {
          destinations: 0x01,
          value: 'first'
        },
        second: {
          destinations: 0x01,
          value: [ 'second' ]
        },
        third: {
          destinations: 0x01,
          value: { key: 'third' }
        },
        fourth: {
          destinations: 0x01,
          value: 4
        },
        fifth: {
          destinations: 0x01,
          value: true
        },
        sixth: {
          destinations: 0x01,
          value: undefined
        },
        seventh: {
          destinations: 0x01,
          value: null
        }
      }

      var res = inst.get(0x01)
      expect(Object.keys(res).length).to.equal(4)
      expect(res.second).to.be.undefined
      expect(res.third).to.be.undefined
      expect(res.sixth).to.be.undefined
    })

    it('returns attributes up to specified limit, regardless of position', function() {
      inst = new TraceAttributes({ limit: 2 })
      inst.attributes = {
        first: {
          destinations: 0x08,
          value: 'first'
        },
        second: {
          destinations: 0x01,
          value: 'second'
        },
        third: {
          destinations: 0x01,
          value: 'third'
        }
      }

      var res = inst.get(0x01)
      expect(Object.keys(res).length).to.equal(2)
      expect(res.first).to.be.undefined
    })
  })

  describe('#reset', function() {
    it('resets instance attributes and count', function() {
      inst = new TraceAttributes()
      inst.attributes = {
        first: {
          destinations: 0x08,
          value: 'first'
        },
        second: {
          destinations: 0x01,
          value: 'second'
        },
        third: {
          destinations: 0x01,
          value: 'third'
        }
      }
      inst.count = 3

      inst.reset()

      expect(inst.attributes).to.deep.equal({})
      expect(inst.count).to.equal(0)
    })
  })
})
