'use strict'

var Heap = require('@tyriar/fibonacci-heap').FibonacciHeap

function PriorityQueue(limit, data) {
  this.limit = limit || 10
  this.seen = 0

  this._data = new Heap()

  data && data.forEach(function add(e) {
    this.add(e.value, e.priority)
  })

  Object.defineProperty(this, 'length', {
    get: function getLength() {
      return this._data._nodeCount
    }
  })
}

PriorityQueue.prototype.overflow = function overflow() {
  var diff = this.seen - this.limit
  return diff >= 0 ? diff : 0
}

PriorityQueue.prototype.add = function add(value, priority) {
  priority = priority || Math.random()
  this.seen++
  if (this.length === this.limit) {
    if (priority <= this._data.findMinimum().key) {
      return
    }
    this._data.insert(priority, value)
    this._data.extractMinimum()
    return
  }
  this._data.insert(priority, value)
}

PriorityQueue.prototype._bubbleDown = function _bubbleDown(current, curIdx) {
  var childIdx = this._getChildIdx(curIdx)
  while (
    this._data[childIdx] && current.priority >= this._data[childIdx].priority
  ) {
    var childNode = this._data[childIdx]
    this._data[childIdx] = current
    this._data[curIdx] = childNode
    curIdx = childIdx
    childIdx = this._getChildIdx(curIdx)
  }
}

PriorityQueue.prototype.heapify = function heapify() {
  var parentIdx = getParentIdx(this._data.length - 1)

  for (var i = parentIdx; i >= 0; --i) {
    this._bubbleDown(this._data[i], i)
  }
}

PriorityQueue.prototype.toArray = function toArray() {
  var nodes = []
  var min = this._data.findMinimum()

  if (min) {
    nodes.push(min.value)

    var current = min
    while (current.next !== min) {
      current = current.next
      nodes.push(current.value)
    }
  }

  return nodes
}

PriorityQueue.prototype.setLimit = function setLimit(newLimit) {
  this.limit = newLimit
  while (this._data.length > newLimit) {
    this._data.extractMinimum()
  }
}

PriorityQueue.prototype.merge = function merge(events) {
  if (!events || !events.length) {
    return
  }
  if (!(events instanceof PriorityQueue)) {
    events = new PriorityQueue(events.length, events)
  }

  this._data.union(events)
}

PriorityQueue.prototype._getChildIdx = function _getChildIdx(i) {
  var left = (i << 1) + 1
  var right = left + 1
  return this._data[right] && this._data[right].priority <= this._data[left].priority
    ? right
    : left
}

function getParentIdx(curIdx) {
  return curIdx / 2 | 0
}

module.exports = PriorityQueue
