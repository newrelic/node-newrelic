'use strict'

const chai = require('chai')
const expect = chai.expect
const TraceAttributes = require('../../lib/transaction/trace/attributes')

describe('TraceAttributes', () => {
  let inst = null

  describe('#get', () => {
    it('gets attributes by destination, truncating values if necessary', () => {
      const longVal = [
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
      const res = inst.get(0x01)
      expect(res.valid).to.equal(50)
      expect(Buffer.byteLength(res.tooLong)).to.equal(255)
    })

    it('only returns attributes up to specified limit', () => {
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

      const res = inst.get(0x01)
      expect(Object.keys(res).length).to.equal(2)
      expect(res.third).to.be.undefined
    })

    it('only includes non-null-type primitive attribute values', () => {
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

      const res = inst.get(0x01)
      expect(Object.keys(res).length).to.equal(3)
      expect(res.second).to.be.undefined
      expect(res.third).to.be.undefined
      expect(res.sixth).to.be.undefined
      expect(res.seventh).to.be.undefined
    })

    it('returns attributes up to specified limit, regardless of position', () => {
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

      const res = inst.get(0x01)
      expect(Object.keys(res).length).to.equal(2)
      expect(res.first).to.be.undefined
    })
  })

  describe('#reset', () => {
    it('resets instance attributes and count', () => {
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
