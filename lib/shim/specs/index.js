'use strict'

var hasOwnProperty = require('../../util/properties').hasOwn
var util = require('util')

/**
 * Enumeration of argument indexes.
 *
 * Anywhere that an argument index is used, one of these or a direct integer
 * value can be used. These are just named constants to improve readability.
 *
 * Each of these values is also exposed directly on the DatastoreShim class as
 * static members.
 *
 * @readonly
 * @memberof Shim.prototype
 * @enum {number}
 */
var ARG_INDEXES = {
  FIRST: 0,
  SECOND: 1,
  THIRD: 2,
  FOURTH: 3,
  LAST: -1
}

exports.ARG_INDEXES = ARG_INDEXES

exports.cast = cast

exports.MiddlewareSpec = MiddlewareSpec
exports.RecorderSpec = RecorderSpec
exports.SegmentSpec = SegmentSpec
exports.WrapSpec = WrapSpec

function cast(Class, spec) {
  return spec instanceof Class ? spec : new Class(spec)
}

function WrapSpec(spec) {
  this.wrapper = typeof spec === 'function' ? spec : spec.wrapper
  this.matchArity = hasOwnProperty(spec, 'matchArity') ? spec.matchArity : false
}

function SegmentSpec(spec) {
  this.name       = hasOwnProperty(spec, 'name') ? spec.name : null
  this.recorder   = hasOwnProperty(spec, 'recorder') ? spec.recorder : null
  this.inContext  = hasOwnProperty(spec, 'inContext') ? spec.inContext : null
  this.parent     = hasOwnProperty(spec, 'parent') ? spec.parent : null
  this.parameters = hasOwnProperty(spec, 'parameters') ? spec.parameters : null
  this.internal   = hasOwnProperty(spec, 'internal') ? spec.internal : false
  this.opaque     = hasOwnProperty(spec, 'opaque') ? spec.opaque : false
}

function RecorderSpec(spec) {
  SegmentSpec.call(this, spec)
  this.stream           = hasOwnProperty(spec, 'stream') ? spec.stream : null
  this.promise          = hasOwnProperty(spec, 'promise') ? spec.promise : null
  this.callback         = hasOwnProperty(spec, 'callback') ? spec.callback : null
  this.rowCallback      = hasOwnProperty(spec, 'rowCallback') ? spec.rowCallback : null
  this.after            = hasOwnProperty(spec, 'after') ? spec.after : null
  this.callbackRequired =
    hasOwnProperty(spec, 'callbackRequired') ? spec.callbackRequired : null
}
util.inherits(RecorderSpec, SegmentSpec)

function MiddlewareSpec(spec) {
  RecorderSpec.call(this, spec)
  this.req        = hasOwnProperty(spec, 'req' ) ? spec.req : ARG_INDEXES.FIRST
  this.res        = hasOwnProperty(spec, 'res' ) ? spec.res : ARG_INDEXES.SECOND
  this.next       = hasOwnProperty(spec, 'next' ) ? spec.next : ARG_INDEXES.THIRD
  this.type       = hasOwnProperty(spec, 'type' ) ? spec.type : 'MIDDLEWARE'
  this.route      = hasOwnProperty(spec, 'route' ) ? spec.route : null
  this.params     = hasOwnProperty(spec, 'params') ? spec.params : _defaultGetParams
  this.appendPath = hasOwnProperty(spec, 'appendPath') ? spec.appendPath : true
}
util.inherits(MiddlewareSpec, RecorderSpec)

function _defaultGetParams(shim, fn, name, args, req) {
  return req && req.params
}
