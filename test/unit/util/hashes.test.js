'use strict'

const expect = require('chai').expect
const hashes = require('../../../lib/util/hashes')

describe('hashes', () => {
  describe('#makeId', () => {
    it('always returns the correct length', () => {
      for (let length = 4; length < 64; length++) {
        for (let attempts = 0; attempts < 500; attempts++) {
          const id = hashes.makeId(length)
          expect(id.length).to.equal(length)
        }
      }
    })

    it('always unique', () => {
      let ids = {}
      for (let length = 16; length < 64; length++) {
        for (let attempts = 0; attempts < 500; attempts++) {
          const id = hashes.makeId(length)

          // Should be unique
          expect(ids[id]).to.be.undefined
          ids[id] = true

          // and the correct length
          expect(id.length).to.equal(length)
        }
      }
    })
  })
})
