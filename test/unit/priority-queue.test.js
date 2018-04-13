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
    it('replaces lowest priority item if limit is met', function() {
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
        'new parent', 'left child', 'right child', 'left grandchild'
      ])
    })
  })

  describe('#setLimit', function() {
    it('resets the limit property and slices the data if necessary', function() {
      queue = new PriorityQueue(5)

      expect(queue.limit).to.equal(5)
      queue.setLimit(10)
      expect(queue.limit).to.equal(10)
      queue._data = [
        {value: 0, priority: 0.5},
        {value: 1, priority: 1},
        {value: 2, priority: 2},
        {value: 3, priority: 3},
        {value: 4, priority: 4},
        {value: 5, priority: 5}
      ]
      queue.setLimit(5)
      expect(queue._data).to.deep.equal([
        {value: 1, priority: 1},
        {value: 3, priority: 3},
        {value: 2, priority: 2},
        {value: 5, priority: 5},
        {value: 4, priority: 4}
      ])
    })
  })

  describe('heapify', function() {
    it('turns an array into a heap', function() {
      queue = new PriorityQueue()

      queue._data = [
        {value: 5, priority: 5},
        {value: 4, priority: 4},
        {value: 3, priority: 3},
        {value: 2, priority: 2},
        {value: 1, priority: 1}
      ]

      queue.heapify()

      var i = 0
      var childIdx = queue._getChildIdx(i)
      while (childIdx < queue._data.length) {
        expect(queue._data[childIdx].priority)
          .to.be.greaterThan(queue._data[i].priority)
        childIdx = queue._getChildIdx(++i)
      }
    })
  })
})
