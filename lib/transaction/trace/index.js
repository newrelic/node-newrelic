'use strict'

var AttributeFilter = require('../../config/attribute-filter')
var codec = require('../../util/codec')
var Segment = require('./segment')
var TraceAttributes = require('./attributes')
var logger = require('../../logger').child({component: 'trace'})
var properties = require('../../util/properties')


var DESTS = require('../../config/attribute-filter').DESTINATIONS
var NAMES = require('../../metrics/names')
var FROM_MILLIS = 1e-3


/**
 * A Trace holds the root of the Segment graph and produces the final
 * serialization of the transaction trace.
 *
 * @param {Transaction} transaction The transaction bound to the trace.
 */
function Trace(transaction) {
  if (!transaction) throw new Error('All traces must be associated with a transaction.')

  this.transaction = transaction
  this.filter = transaction.agent.config.attributeFilter

  this.root = new Segment(transaction, 'ROOT')
  this.root.start()

  this.intrinsics = Object.create(null)
  this.segmentsSeen = 0
  this.totalTimeCache = null

  this.custom = new TraceAttributes({ limit: 64 })
  this.attributes = new TraceAttributes()

  // sending displayName if set by user
  var displayName = transaction.agent.config.getDisplayHost()
  var hostName = transaction.agent.config.getHostnameSafe()
  if (displayName !== hostName) {
    this.addAttribute(DESTS.COMMON, 'host.displayName', displayName)
  }
  this.domain = null
}

/**
 * End and close the current trace. Triggers metric recording for trace
 * segments that support recording.
 */
Trace.prototype.end = function end() {
  var segments = [this.root]

  while (segments.length) {
    var segment = segments.pop()
    _softEndSegment(segment)
    Array.prototype.push.apply(segments, segment.getChildren())
  }
}

/**
 * Iterates over the trace tree and generates a span event for each segment.
 */
Trace.prototype.generateSpanEvents = function generateSpanEvents() {
  var config = this.transaction.agent.config

  if (
    this.transaction.sampled &&
    config.span_events.enabled &&
    config.distributed_tracing.enabled
  ) {
    var toProcess = []
    // Root segment does not become a span, so we need to process it separately.
    const spanAggregator = this.transaction.agent.spans
    const children = this.root.getChildren()
    for (let i = 0; i < children.length; ++i) {
      toProcess.push(new DTTraceNode(children[i], this.transaction.parentSpanId))
    }

    while (toProcess.length) {
      var segmentInfo = toProcess.pop()
      var segment = segmentInfo.segment

      // Even though at some point we might want to stop adding events
      // because all the priorities should be the same, we need to count
      // the spans as seen.
      spanAggregator.addSegment(segment, segmentInfo.parentId)

      Array.prototype.push.apply(
        toProcess,
        segment.getChildren().map(child => new DTTraceNode(child, segment.id))
      )
    }
  }
}

function DTTraceNode(segment, parentId) {
  this.segment = segment
  this.parentId = parentId
}

function _softEndSegment(segment) {
  if (segment.timer.softEnd()) {
    segment._updateRootTimer()
    // timer.softEnd() returns true if the timer was ended prematurely, so
    // in that case we can name the segment as truncated
    segment.name = NAMES.TRUNCATED.PREFIX + segment.name
  }
}

/**
 * Add a child to the list of segments.
 *
 * @param {string} childName Name for the new segment.
 * @returns {Segment} Newly-created Segment.
 */
Trace.prototype.add = function add(childName, callback) {
  return this.root.add(childName, callback)
}

/**
 * Explicitly set a trace's runtime instead of using it as a stopwatch.
 * (As a byproduct, stops the timer.)
 *
 * @param {int} duration Duration of this particular trace.
 * @param {int} startTimeInMillis (optional) Start of this trace.
 */
Trace.prototype.setDurationInMillis = setDurationInMillis

function setDurationInMillis(duration, startTimeInMillis) {
  this.root.setDurationInMillis(duration, startTimeInMillis)
}

/**
 * @return {integer} The amount of time the trace took, in milliseconds.
 */
Trace.prototype.getDurationInMillis = function getDurationInMillis() {
  return this.root.getDurationInMillis()
}

/**
 * Adds given key-value pair to trace's agent attributes, if it passes filtering rules.
 *
 * @param {DESTINATIONS}  destinations  - The default destinations for this key.
 * @param {string}        key           - The attribute name.
 * @param {string}        value         - The attribute value.
 */
Trace.prototype.addAttribute = function addAttribute(destinations, key, value) {
  if (this.attributes.isValidLength(key)) {
    // Only set the attribute if at least one destination passed
    destinations = this._filterAttributes(destinations, key)
    if (destinations) {
      this.attributes.set(destinations, key, value)
    }
  } else {
    logger.warn(
      'Length limit exceeded for attribute name, not adding to transaction trace: %s',
      key
    )
  }
}

/**
 * Tests given key against agent config's attribute filter for each supported destination.
 *
 * @param {DESTINATIONS}  destinations  - The default destinations for this key.
 * @param {string}        key           - The attribute name.
 *
 * @return {DESTINATIONS} Allowed destinations.
 */
Trace.prototype._filterAttributes = function _filterAttributes(destinations, key) {
  return this.filter.filter(destinations, key)
}

/**
 * Passthrough method for adding multiple unknown attributes at once.
 * Currently only used for baseSegment parameters.
 *
 * @param {DESTINATIONS}  destinations  - The default destinations for these attributes.
 * @param {object}        attrs         - The attributes to add.
 */
Trace.prototype.addAttributes = function addAttributes(destinations, attrs) {
  for (var key in attrs) {
    if (properties.hasOwn(attrs, key)) {
      this.addAttribute(destinations, key, attrs[key])
    }
  }
}

/**
 * Adds given key-value pair to trace's custom attributes, if it passes filtering rules.
 *
 * @param {string} key    - The attribute name.
 * @param {string} value  - The attribute value.
 */
Trace.prototype.addCustomAttribute = function addCustomAttribute(key, value) {
  if (!this.custom.isValidLength(key)) {
    return logger.error(
      'Length limit exceeded for custom attribute name, not adding to trace: %s',
      key
    )
  }

  var destinations = this._filterAttributes(AttributeFilter.DESTINATIONS.ALL, key)
  if (destinations) {
    if (this.custom.has(key)) {
      logger.debug(
        'Changing custom attribute %s from %s to %s.',
        key,
        this.custom.attributes[key].value,
        value
      )
    }
    this.custom.set(destinations, key, value)
  }
}

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @return {integer} The amount of time the trace took, minus any child
 *                   traces, in milliseconds.
 */
Trace.prototype.getExclusiveDurationInMillis = function getExclusiveDurationInMillis() {
  return this.root.getExclusiveDurationInMillis()
}


/**
 * The duration of all segments in a transaction trace.  The root is not
 * accounted for, since it doesn't represent a unit of work.
 *
 * @return {integer} The sum of durations for all segments in a trace in
 *                   milliseconds
 */
Trace.prototype.getTotalTimeDurationInMillis = function getTotalTimeDurationInMillis() {
  if (this.totalTimeCache !== null) return this.totalTimeCache
  if (this.root.children.length === 0) return 0
  var segments = this.root.getChildren()
  var totalTimeInMillis = 0

  while (segments.length !== 0) {
    var segment = segments.pop()
    totalTimeInMillis += segment.getExclusiveDurationInMillis()
    segments = segments.concat(segment.getChildren())
  }

  if (!this.transaction.isActive()) this.totalTimeCache = totalTimeInMillis
  return totalTimeInMillis
}

/**
 * The serializer is asynchronous, so serialization is as well.
 *
 * The transaction trace sent to the collector is a nested set of arrays. The
 * outermost array has the following fields, in order:
 *
 * 0: start time of the trace, in milliseconds
 * 1: duration, in milliseconds
 * 2: the path, or root metric name
 * 3: the URL (fragment) for this trace
 * 4: an array of segment arrays, deflated and then base64 encoded
 * 5: FIXME: the guid for this transaction, used to correlate across
 *    transactions (for now, to correlate with RUM sessions)
 * 6: reserved for future use, specified to be null for now
 * 7: FIXME: RUM2 force persist flag
 *
 * In addition, there is a "root node" (not the same as the first child, which
 * is a node with the special name ROOT and contents otherwise identical to the
 * top-level segment of the actual trace) with the following fields:
 *
 * 0: start time IN SECONDS
 * 1: a dictionary containing request parameters
 * 2: a dictionary containing custom parameters (currently not user-modifiable)
 * 3: the transaction trace segments (including the aforementioned root node)
 * 4: FIXME: a dictionary containing "parameter groups" with special information
 *    related to this trace
 *
 * @param {Function} callback Called after serialization with either
 *                            an error (in the first parameter) or
 *                            the serialized transaction trace.
 */
Trace.prototype.generateJSON = function generateJSON(callback) {
  var attributes = {
    agentAttributes: this.attributes.get(AttributeFilter.DESTINATIONS.TRANS_TRACE),
    userAttributes: this.custom.get(AttributeFilter.DESTINATIONS.TRANS_TRACE),
    intrinsics: this.intrinsics
  }

  var rootNode = [
    this.root.timer.start * FROM_MILLIS,
    {}, // moved to agentAttributes
    {
      // hint to RPM for how to display this trace's segments
      nr_flatten_leading: false
    }, // moved to userAttributes
    this.root.toJSON(),
    attributes,
    []  // FIXME: parameter groups
  ]

  var trace = this
  if (!this.transaction.agent.config.simple_compression) {
    codec.encode(rootNode, respond)
  } else {
    setImmediate(respond, null, rootNode)
  }

  function respond(err, data) {
    if (err) {
      return callback(err, null, null)
    }

    var syntheticsResourceId = null
    // FLAG: synthetics not feature flagged here, but this will only get set if
    // the flag is on.
    if (trace.transaction.syntheticsData) {
      syntheticsResourceId = trace.transaction.syntheticsData.resourceId
    }

    var json = [
      trace.root.timer.start, // start
      trace.transaction.getResponseTimeInMillis(),  // response time
      trace.transaction.getFullName(),              // path
      trace.transaction.url,  // request.uri
      data,                   // encodedCompressedData
      '',                     // guid
      null,                   // reserved for future use
      false,                  // forcePersist
      null,                   // xraySessionId
      syntheticsResourceId    // synthetics resource id
    ]

    return callback(null, json, trace)
  }
}

module.exports = Trace
