'use strict'

function TraceAttributes() {
  this.attributes = {}
}

TraceAttributes.prototype.set = function set(destinations, key, value) {
  this.attributes[key] = {
    value: value,
    destinations: destinations
  }
}

TraceAttributes.prototype.get = function get(dest) {
  var atts = this.attributes
  // get all attributes where `dest` is included in destinations prop
  return Object.keys(atts).reduce(function filterDests(obj, key) {
    if (atts[key].destinations.indexOf(dest) >= 0) {
      obj[key] = atts[key].value
    }
    return obj
  }, {})
}

TraceAttributes.prototype.has = function has(key) {
  return (key in this.attributes)
}

module.exports = TraceAttributes
