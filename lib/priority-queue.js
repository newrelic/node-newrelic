'use strict'

function PriorityQueue(limit) {
  this.limit = limit || 10
  this.seen = 0
  this._data = []
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
  this._data[0] = this._data.pop()
  var curIdx = 0
  var childIdx = this._getChildIdx(curIdx)
  while (this._data[childIdx] && this._data[curIdx].priority >= this._data[childIdx].priority) {
    var curNode = this._data[curIdx]
    var childNode = this._data[childIdx]
    this._data[childIdx] = curNode
    this._data[curIdx] = childNode
    curIdx = childIdx
    childIdx = this._getChildIdx(curIdx)
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
  if (!events || !Object.keys(events).length) {
    return
  }
  // TODO: can definitely be optimized
  for (var i = 0; i < events.length; i++) {
    var event = events[i]
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
