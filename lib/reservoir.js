// from http://en.wikipedia.org/wiki/Reservoir_sampling

function Reservoir() {
  this.limit = 10
  this._size = 0
  this._data = []

  this.Random = Math.random
  this.Floor  = Math.floor
}

Reservoir.prototype.overflow = function overflow() {
  var diff = this._size - this.limit
  return diff >= 0 ? diff : 0
}

Reservoir.prototype.add = function add(item) {
  var k = this.limit
  var i = this._size ++

  if (i < k) {
    this._data.push(item)
  } else {
    var j = this.Floor(this.Random() * (i + 2))
    if (j < k) this._data[j] = item
  }

}

Reservoir.prototype.toArray = function toArray() {
  return this._data
}

module.exports = Reservoir
