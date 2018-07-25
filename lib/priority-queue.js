'use strict'

var Heap = require('@tyriar/fibonacci-heap').FibonacciHeap

function PriorityQueue(limit) {
  this.limit = limit == null ? 10 : limit
  this.seen = 0
  this._data = new Heap()

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

PriorityQueue.prototype.getMinimumPriority = function getMinimumPriority() {
  return this.length < this.limit ? 0 : this._data.findMinimum().key
}

PriorityQueue.prototype.add = function add(value, priority) {
  this.seen++
  if (this.limit <= 0) {
    return false
  }
  priority = priority || Math.random()
  if (this.length === this.limit) {
    return this._replace(value, priority)
  }
  this._data.insert(priority, value)
  return true
}

PriorityQueue.prototype._replace = function _replace(value, priority) {
  if (priority > this._data.findMinimum().key) {
    this._data.insert(priority, value)
    this._data.extractMinimum()
    return true
  }
  return false
}

PriorityQueue.prototype.getRawEvents = function getRawEvents() {
  var events = []
  var min = this._data.findMinimum()

  if (min) {
    _getRawEvents(min, events)
  }

  return events

  function _getRawEvents(head, evts) {
    var current = head

    do {
      evts.push({value: current.value, priority: current.key})
      if (current.child) {
        _getRawEvents(current.child, evts)
      }
      current = current.next
    } while (current !== head)
  }
}

PriorityQueue.prototype.toArray = function toArray() {
  var nodes = []
  var min = this._data.findMinimum()

  if (min) {
    serializeHeap(min, nodes)
  }

  return nodes

  function serializeHeap(head, arr) {
    var current = head

    do {
      arr.push(current.value)
      if (current.child) {
        serializeHeap(current.child, arr)
      }
      current = current.next
    } while (current !== head)
  }
}

PriorityQueue.prototype.setLimit = function setLimit(newLimit) {
  this.limit = newLimit
  while (this.length > newLimit) {
    this._data.extractMinimum()
  }
}

PriorityQueue.prototype.merge = function merge(events) {
  if (!events || !events.length) {
    return
  }

  if (events instanceof PriorityQueue) {
    while (events.length) {
      var current = events._data.extractMinimum()
      this.add(current.value, current.key)
    }
  } else {
    for (var i = 0; i < events.length; ++i) {
      this.add(events[i].value, events[i].priority)
    }
  }
}

module.exports = PriorityQueue
