'use strict'

var chai = require('chai')
var expect = chai.expect
var PriorityQueue = require('../../lib/priority-queue')

describe('PriorityQueue', function() {
  var queue = null

  describe('#add', function() {
    it('structures the data as a min heap', function() {
      queue = new PriorityQueue()

      queue.add('right child', 10)
      queue.add('parent', 1)
      queue.add('left child', 5)
      queue.add('left grandchild', 8)

      expect(queue.toArray()).to.deep.equal([
        'parent', 'left child', 'right child', 'left grandchild'
      ])
    })
    it('replaces lowest priority item if limit is met and rebalances itself', function() {
      queue = new PriorityQueue(4)

      queue.add('right child', 10)
      queue.add('parent', 1)
      queue.add('left child', 5)
      queue.add('left grandchild', 8)

      expect(queue.toArray()).to.deep.equal([
        'parent', 'left child', 'right child', 'left grandchild'
      ])

      queue.add('new parent', 2)

      expect(queue.toArray()).to.deep.equal([
        'new parent', 'left grandchild', 'left child', 'right child'
      ])
    })
  })

  describe('#setLimit', function() {
    it('resets the limit property and slices the data if necessary', function() {
      queue = new PriorityQueue(5)

      expect(queue.limit).to.equal(5)
      queue.setLimit(10)
      expect(queue.limit).to.equal(10)
      queue._data = [1, 2, 3, 4, 5, 6]
      queue.setLimit(5)
      expect(queue._data).to.deep.equal([1, 2, 3, 4, 5])
    })
  })
})
