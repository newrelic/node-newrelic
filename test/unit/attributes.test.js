'use strict'

const {expect} = require('chai')
const helper = require('../lib/agent_helper')
const Attributes = require('../../lib/attributes')
const AttributeFilter = require('../../lib/config/attribute-filter')

const DESTINATIONS = AttributeFilter.DESTINATIONS
const TRANSACTION_SCOPE = 'transaction'

describe('Attributes', () => {
  let agent = null
  beforeEach(() => {
    // Load agent to get a config instance.
    agent = helper.loadMockedAgent()
  })
  afterEach(() => {
    helper.unloadAgent(agent)
  })


  describe('#addAttribute', () => {
    it('adds an attribute to instance', () => {
      const inst = new Attributes(TRANSACTION_SCOPE)
      inst.addAttribute(DESTINATIONS.TRANS_SCOPE, 'test', 'success')
      const attributes = inst.get(DESTINATIONS.TRANS_SCOPE)
      expect(attributes).to.have.property('test', 'success')
    })

    it('does not add attribute if key length limit is exceeded', () => {
      const  tooLong = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
        'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
        'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.'
      ].join(' ')

      const inst = new Attributes(TRANSACTION_SCOPE)
      inst.addAttribute(DESTINATIONS.TRANS_SCOPE, tooLong, 'will fail')
      const attributes = Object.keys(inst.attributes)
      expect(attributes.length).to.equal(0)
    })
  })

  describe('#addAttributes', () => {
    it('adds multiple attributes to instance', () => {
      const inst = new Attributes(TRANSACTION_SCOPE)
      inst.addAttributes(
        DESTINATIONS.TRANS_SCOPE,
        {one: '1', two: '2'}
      )
      const attributes = inst.get(DESTINATIONS.TRANS_SCOPE)
      expect(attributes).to.have.property('one', '1')
      expect(attributes).to.have.property('two', '2')
    })

    it('only allows non-null-type primitive attribute values', () => {
      const inst = new Attributes(TRANSACTION_SCOPE, 10)
      const attributes = {
        first: 'first',
        second: [ 'second' ],
        third: { key: 'third' },
        fourth: 4,
        fifth: true,
        sixth: undefined,
        seventh: null,
        eighth: Symbol('test'),
        ninth: function() {}
      }

      inst.addAttributes(
        DESTINATIONS.TRANS_SCOPE,
        attributes
      )

      const res = inst.get(DESTINATIONS.TRANS_SCOPE)
      expect(Object.keys(res).length).to.equal(3)
      expect(res.second).to.be.undefined
      expect(res.third).to.be.undefined
      expect(res.sixth).to.be.undefined
      expect(res.seventh).to.be.undefined
      expect(res.eighth).to.be.undefined
      expect(res.ninth).to.be.undefined
    })
  })

  describe('#get', () => {
    it('gets attributes by destination, truncating values if necessary', () => {
      const longVal = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Cras id lacinia erat. Suspendisse mi nisl, sodales vel est eu,',
        'rhoncus lacinia ante. Nulla tincidunt efficitur diam, eget vulputate',
        'lectus facilisis sit amet. Morbi hendrerit commodo quam, in nullam.',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
      ].join(' ')

      const inst = new Attributes(TRANSACTION_SCOPE)
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
      const inst = new Attributes(TRANSACTION_SCOPE, 2)
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

    it('returns attributes up to specified limit, regardless of position', () => {
      const inst = new Attributes(TRANSACTION_SCOPE, 2)
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
    it('resets instance attributes', () => {
      const inst = new Attributes(TRANSACTION_SCOPE)
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

      inst.reset()

      expect(inst.attributes).to.deep.equal({})
    })
  })
})
