// from http://en.wikipedia.org/wiki/Reservoir_sampling

function Reservoir(limit) {
  this.limit = limit || 10
  this.seen = 0
  this._data = []
}

Reservoir.prototype.overflow = function overflow() {
  var diff = this.seen - this.limit
  return diff >= 0 ? diff : 0
}

Reservoir.prototype.add = function add(item) {
  if (this.seen < this.limit) {
    this._data.push(item)
  } else {
    var toReplace = Math.floor(Math.random() * (this.seen + 2))
    if (toReplace < this.limit) this._data[toReplace] = item
  }
  this.seen++
}

Reservoir.prototype.toArray = function toArray() {
  return this._data
}

module.exports = Reservoir
