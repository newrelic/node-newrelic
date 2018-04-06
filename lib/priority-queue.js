'use strict'

function PriorityQueue(limit) {
  this.limit = limit || 10
  this.seen = 0
  this._data = []
}

PriorityQueue.prototype.overflow = function overflow() {
  return this.seen - this.limit
}

PriorityQueue.prototype.add = function add(value, priority) {
  var newNode = Object.create({
    value: value,
    priority: priority
  })
  this._data.push(newNode)
  var curIdx = this._data.length - 1
  var parentIdx = getParentIdx(curIdx)
  while (this._data[parentIdx] && newNode.priority < this._data[parentIdx].priority) {
    var parent = this._data[parentIdx]
    this._data[parentIdx] = newNode
    this._data[curIdx] = parent
    curIdx = parentIdx
    parentIdx = getParentIdx(curIdx)
  }
  if (this._data.length > this.limit) {
    this._removeLowestPriority()
  }
  this.seen++
}

PriorityQueue.prototype._removeLowestPriority = function _removeLowestPriority() {
  var self = this
  this._data[0] = this._data.pop()
  var curIdx = 0
  var child = getChildIdx(curIdx)
  while (this._data[child] && this._data[curIdx].priority >= this._data[child].priority) {
    var curNode = this._data[curIdx]
    var childNode = this._data[child]
    this._data[child] = curNode
    this._data[curIdx] = childNode
    curIdx = child
    child = getChildIdx(curIdx)
  }

  function getChildIdx(i) {
    var left = i + i + 1
    var right = i + i + 2
    return self._data[right] && self._data[right].priority <= self._data[left].priority
      ? right
      : left
  }
}

PriorityQueue.prototype.toArray = function toArray() {
  return this._data.map(function getValue(i) {
    return i.value
  })
}

PriorityQueue.prototype.setLimit = function setLimit(newLimit) {
  this.limit = newLimit
  if (this._data.length > newLimit) {
    this._data = this._data.slice(0, newLimit)
  }
}

PriorityQueue.prototype.merge = function merge(events) {
  if (!events || !Object.keys(events).length) {
    return
  }
  for (var i = 0; i < events.length; i++) {
    var event = events[i]
    this.add(event.value, event.priority)
  }
}

function getParentIdx(curIdx) {
  return Math.floor(curIdx / 2)
}

module.exports = PriorityQueue
