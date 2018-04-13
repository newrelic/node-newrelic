'use strict'

function PriorityQueue(limit, data) {
  this.limit = limit || 10
  this.seen = 0
  this._data = data || []

  this.heapify()

  Object.defineProperty(this, 'length', {
    get: function getLength() {
      return this._data.length
    }
  })
}

PriorityQueue.prototype.overflow = function overflow() {
  var diff = this.seen - this.limit
  return diff >= 0 ? diff : 0
}

PriorityQueue.prototype.add = function add(value, priority) {
  var newNode = {
    value: value,
    priority: priority || Math.random()
  }
  this._data.push(newNode)
  this.seen++
  if (this._data.length > this.limit) {
    this._removeMin()
    return
  }
  var curIdx = this._data.length - 1
  var parentIdx = getParentIdx(curIdx)
  while (this._data[parentIdx] && newNode.priority < this._data[parentIdx].priority) {
    this._data[curIdx] = this._data[parentIdx]
    this._data[parentIdx] = newNode
    curIdx = parentIdx
    parentIdx = getParentIdx(curIdx)
  }
}

PriorityQueue.prototype._removeMin = function _removeMin() {
  var current = this._data[0] = this._data.pop()
  var curIdx = 0
  this._bubbleDown(current, curIdx)
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
  return this._data.map(function getValue(i) {
    return i.value
  })
}

PriorityQueue.prototype.setLimit = function setLimit(newLimit) {
  this.limit = newLimit
  while (this._data.length > newLimit) {
    this._removeMin()
  }
}

PriorityQueue.prototype.merge = function merge(events) {
  if (!events || !events.length) {
    return
  }
  if (!(events instanceof PriorityQueue)) {
    events = new PriorityQueue(events.length, events)
  }

  while (events.length + this._data.length > this.limit) {
    if (events._data[0].priority < this._data[0].priority) {
      events._removeMin()
    } else {
      this._removeMin()
    }
  }
  // TODO: can definitely be optimized
  for (var i = 0; i < events.length; i++) {
    var event = events._data[i]
    this.add(event.value, event.priority)
  }
}

PriorityQueue.prototype._getChildIdx = function _getChildIdx(i) {
  var left = i + i + 1
  var right = i + i + 2
  return this._data[right] && this._data[right].priority <= this._data[left].priority
    ? right
    : left
}

function getParentIdx(curIdx) {
  return Math.floor(curIdx / 2)
}

module.exports = PriorityQueue
