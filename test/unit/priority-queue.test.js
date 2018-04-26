'use strict'

var chai = require('chai')
var expect = chai.expect
var PriorityQueue = require('../../lib/priority-queue')

describe('PriorityQueue', function() {
  var queue = null

  describe('#add', function() {
    it('structures the data as a min heap', function() {
      queue = new PriorityQueue()

      queue.add('left grandchild', 10)
      queue.add('parent', 1)
      queue.add('right child', 5)
      queue.add('left child', 8)

      expect(queue.toArray()).to.deep.equal([
        'parent', 'left child', 'right child', 'left grandchild'
      ])
    })
    it('replaces lowest priority item if limit is met', function() {
      queue = new PriorityQueue(4)

      queue.add('left grandchild', 10)
      queue.add('parent', 1)
      queue.add('right child', 5)
      queue.add('left child', 8)

      expect(queue.toArray()).to.deep.equal([
        'parent', 'left child', 'right child', 'left grandchild'
      ])

      queue.add('new parent', 2)

      expect(queue.toArray()).to.deep.equal([
        'new parent', 'right child', 'left grandchild', 'left child'
      ])
    })
  })

  describe('#merge', function() {
    it('merges two sources and maintains the limit', function() {
      var queueLimit = 4
      var queue1 = new PriorityQueue(queueLimit)
      var queue2 = new PriorityQueue(queueLimit)

      for (var pri = 0; pri < queueLimit; ++pri) {
        queue1.add('test', pri)
        queue2.add('test', pri)
      }

      queue1.merge(queue2)
      expect(queue1.length).to.equal(queueLimit)
    })
  })

  describe('#setLimit', function() {
    it('resets the limit property and slices the data if necessary', function() {
      queue = new PriorityQueue(5)

      expect(queue.limit).to.equal(5)
      queue.setLimit(10)
      expect(queue.limit).to.equal(10)

      for (var i = 0; i < 6; i++) {
        queue.add(i, i)
      }

      expect(queue.length).to.equal(6)
      expect(queue.toArray()).to.deep.equal([0, 5, 4, 3, 2, 1])
      queue.setLimit(5)
      expect(queue.toArray()).to.deep.equal([1, 2, 3, 4, 5])
      expect(queue.length).to.equal(5)
    })
  })
})
