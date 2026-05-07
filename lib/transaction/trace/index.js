/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const codec = require('../../util/codec')
const urltils = require('../../util/urltils')
const TraceSegment = require('./segment')
const { Attributes, MAXIMUM_CUSTOM_ATTRIBUTES } = require('../../attributes')
const logger = require('../../logger').child({ component: 'trace' })
const { DESTINATIONS } = require('../../config/attribute-filter')
const FROM_MILLIS = 1e-3
const ATTRIBUTE_SCOPE = Attributes.SCOPE_TRANSACTION
const REQUEST_URI_KEY = 'request.uri'
const UNKNOWN_URI_PLACEHOLDER = '/Unknown'
const SegmentTree = require('./segment-tree')

/**
 * A Trace holds the root of the Segment graph and produces the final
 * serialization of the transaction trace.
 *
 * @param {Transaction} transaction The transaction bound to the trace.
 *
 * @class {object} TransactionTrace
 */
function Trace(transaction) {
  if (!transaction) {
    throw new Error('All traces must be associated with a transaction.')
  }

  this.transaction = transaction

  const root = new TraceSegment({
    config: transaction.agent.config,
    name: 'ROOT',
    collect: transaction.collect
  })
  root.start()
  transaction.incrementCounters()

  this.intrinsics = Object.create(null)
  this.segments = new SegmentTree(root)
  this.root = this.segments.root.segment
  this.totalTimeCache = null

  this.custom = new Attributes({
    scope: ATTRIBUTE_SCOPE,
    limit: MAXIMUM_CUSTOM_ATTRIBUTES,
    valueLengthLimit: transaction.agent.config.attributes.value_size_limit
  })
  this.attributes = new Attributes({
    scope: ATTRIBUTE_SCOPE,
    valueLengthLimit: transaction.agent.config.attributes.value_size_limit
  })

  // sending displayName if set by user
  const displayName = transaction.agent.config.getDisplayHost()
  const hostName = transaction.agent.config.getHostnameSafe()
  if (displayName !== hostName) {
    this.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'host.displayName', displayName)

    this.displayName = displayName
  }
  this.domain = null
}

/**
 * End and close the current trace. Triggers metric recording for trace
 * segments that support recording.
 * @param {Node} [node] the node to process the segment and its children
 */
Trace.prototype.end = function end(node = this.segments.root) {
  const { children, segment } = node
  segment.finalize(this)

  for (let i = 0; i < children.length; ++i) {
    this.end(children[i])
  }
}

/**
 * Iterates over the trace tree and generates a span event for each segment.
 * @param {Node} [node] the node to process the segment and its children
 */
Trace.prototype.generateSpanEvents = function generateSpanEvents(node = this.segments.root) {
  const config = this.transaction.agent.config

  if (!shouldGenerateSpanEvents(config, this.transaction)) {
    return
  }

  const { children, segment } = node

  // Root segment does not become a span, so we need to process it separately.
  const spanAggregator = this.transaction.agent.spanEventAggregator
  if (children.length && segment.name === 'ROOT') {
    // At the point where these attributes are available, we only have a
    // root span. Adding attributes to first non-root span here.
    const attributeMap = {
      'host.displayName': this.displayName,
      'parent.type': this.transaction.parentType,
      'parent.app': this.transaction.parentApp,
      'parent.account': this.transaction.parentAcct,
      'parent.transportType': this.transaction.parentTransportType,
      'parent.transportDuration': this.transaction.parentTransportDuration
    }

    for (const [key, value] of Object.entries(attributeMap)) {
      if (value !== null) {
        children[0].segment.addSpanAttribute(key, value)
      }
    }
  }

  if (segment.id !== this.root.id) {
    const isRoot = segment.parentId === this.root.id
    const parentId = isRoot ? this.transaction.parentSpanId : segment.parentId
    const isEntry = this.transaction?.baseSegment?.id === segment.id
    // Even though at some point we might want to stop adding events because all the priorities
    // should be the same, we need to count the spans as seen.
    spanAggregator.addSegment({
      segment,
      transaction: this.transaction,
      parentId,
      isEntry,
      isRoot
    })
  }

  for (let i = 0; i < children.length; ++i) {
    this.generateSpanEvents(children[i])
  }
}

function shouldGenerateSpanEvents(config, txn) {
  if (!(config.distributed_tracing.enabled && config.span_events.enabled)) {
    return false
  }

  const infiniteTracingConfigured = Boolean(config.infinite_tracing.trace_observer.host)
  return infiniteTracingConfigured || txn.sampled
}

/**
 * Add a child to the list of segments.
 *
 * @param {string} childName Name for the new segment.
 * @param {Function} callback Callback function to record metrics related to the trace
 * @param {TraceSegment} parent parent of new segment
 * @returns {TraceSegment} Newly-created segment.
 */
Trace.prototype.add = function add(childName, callback, parent) {
  const { tracer } = this.transaction.agent
  parent = parent || this.root
  return tracer.createSegment({
    name: childName,
    recorder: callback,
    parent,
    transaction: this.transaction
  })
}

/**
 * Explicitly set a trace's runtime instead of using it as a stopwatch.
 * (As a byproduct, stops the timer.)
 *
 * @param {number} duration Duration of this particular trace.
 * @param {number} startTimeInMillis (optional) Start of this trace.
 */
Trace.prototype.setDurationInMillis = setDurationInMillis

function setDurationInMillis(duration, startTimeInMillis) {
  this.root.setDurationInMillis(duration, startTimeInMillis)
}

/**
 * @returns {number} The amount of time the trace took, in milliseconds.
 */
Trace.prototype.getDurationInMillis = function getDurationInMillis() {
  return this.root.getDurationInMillis()
}

/**
 * Adds given key-value pair to trace's custom attributes, if it passes filtering rules.
 *
 * @param {string} key    - The attribute name.
 * @param {string} value  - The attribute value.
 */
Trace.prototype.addCustomAttribute = function addCustomAttribute(key, value) {
  if (this.custom.has(key)) {
    logger.debug(
      'Potentially changing custom attribute %s from %s to %s.',
      key,
      this.custom.attributes[key].value,
      value
    )
  }

  this.custom.addAttribute(DESTINATIONS.TRANS_SCOPE, key, value)
}

/**
 * The duration of the transaction trace tree that only this level accounts
 * for.
 *
 * @returns {number} The amount of time the trace took, minus any child
 *                   traces, in milliseconds.
 */
Trace.prototype.getExclusiveDurationInMillis = function getExclusiveDurationInMillis() {
  return this.root.getExclusiveDurationInMillis(this)
}

/**
 * The duration of all segments in a transaction trace.  The root is not
 * accounted for, since it doesn't represent a unit of work.
 *
 * @returns {number} The sum of durations for all segments in a trace in
 *                   milliseconds
 */
Trace.prototype.getTotalTimeDurationInMillis = function getTotalTimeDurationInMillis() {
  if (this.totalTimeCache !== null) {
    return this.totalTimeCache
  }

  const total = this._computeTotalTime()

  if (!this.transaction.isActive()) {
    this.totalTimeCache = total
  }
  return total
}

/**
 * Performs a depth-first search to collect all segments from segment tree
 * into an array
 *
 * @returns {Array} of all collected trace segments
 */
Trace.prototype._collectSegments = function _collectSegments() {
  const rootNode = this.segments.root

  const segmentTree = [rootNode]
  for (let i = 0; i < segmentTree.length; i++) {
    for (const child of segmentTree[i].children) {
      segmentTree.push(child)
    }
  }

  return segmentTree
}

/**
 * Merges two sorted arrays of time ranges into a single sorted array of non-overlapping ranges.
 *
 * Each range is a two-element array `[start, end]` representing a time interval.
 * When ranges overlap, they are combined into a single range spanning the full extent.
 *
 * **Note:** This function is destructive — it mutates end times of elements in the input
 * arrays when merging overlapping intervals. Do not reuse the input arrays after calling this.
 *
 * @private
 * @param {Array} first - A sorted array of `[start, end]` time ranges.
 * @param {Array} second - A sorted array of `[start, end]` time ranges.
 * @returns {Array} A new sorted array of merged, non-overlapping time ranges.
 */
Trace.prototype._mergeRanges = function _mergeRanges(first, second) {
  if (!first.length) {
    return second
  }

  if (!second.length) {
    return first
  }

  const res = []
  let resIdx = 0
  let firstIdx = 0
  let secondIdx = 0
  // N.B. this is destructive, it will be updating the end times for range arrays in
  // the input arrays.  If we need to reuse these arrays for anything, this behavior
  // must be changed.
  let currInterval =
    first[firstIdx][0] < second[secondIdx][0] ? first[firstIdx++] : second[secondIdx++]

  while (firstIdx < first.length && secondIdx < second.length) {
    const next = first[firstIdx][0] < second[secondIdx][0] ? first[firstIdx++] : second[secondIdx++]
    if (next[0] <= currInterval[1]) {
      // if the segment overlaps, update the end of the current merged segment
      currInterval[1] = Math.max(next[1], currInterval[1])
    } else {
      // if there is no overlap, start a new merging segment and push the old one
      res[resIdx++] = currInterval
      currInterval = next
    }
  }

  const firstIsRemainder = firstIdx !== first.length
  const remainder = firstIsRemainder ? first : second
  let remainderIdx = firstIsRemainder ? firstIdx : secondIdx

  // merge the segments overlapping with the current interval
  while (remainder[remainderIdx] && remainder[remainderIdx][0] <= currInterval[1]) {
    currInterval[1] = Math.max(remainder[remainderIdx++][1], currInterval[1])
  }

  res[resIdx++] = currInterval

  // append the remaining non-overlapping ranges
  for (; remainderIdx < remainder.length; ++remainderIdx) {
    res[resIdx++] = remainder[remainderIdx]
  }

  return res
}

/**
 * Computes total time and exclusive durations for all segments in a single
 * post-order traversal of the segment tree.  Avoids repeated tree lookups by
 * working directly with SegmentTree nodes and propagating merged time ranges
 * up the tree.
 *
 * @private
 * @returns {number} sum of exclusive durations for all non-root segments
 */
Trace.prototype._computeTotalTime = function _computeTotalTime() {
  const segmentTree = this._collectSegments()
  const rootNode = this.segments.root

  // Process bottom-up (reverse of pre-order guarantees children before parents)
  let total = 0
  let maxEnd = this.root.timer.start

  for (let i = segmentTree.length - 1; i >= 0; i--) {
    const node = segmentTree[i]
    const { segment, children } = node

    // Merge all direct children's propagated ranges
    let childPairs = []
    for (const child of children) {
      childPairs = this._mergeRanges(childPairs, child._ranges)
      child._ranges = null
    }

    segment.calculateExclusiveDuration(childPairs)

    // Track the furthest end time across all segments to keep root timer accurate
    const end = segment.timer.start + segment.getDurationInMillis()
    if (end > maxEnd) {
      maxEnd = end
    }

    // Propagate this segment's full range merged with child ranges to its parent
    node._ranges = this._mergeRanges(childPairs, [segment.timer.toRange()])

    if (node !== rootNode) {
      total += segment.getExclusiveDurationInMillis()
    }
  }

  // Update root timer to span the furthest-reaching segment
  const rootDuration = maxEnd - this.root.timer.start
  if (rootDuration > this.root.getDurationInMillis()) {
    this.root.overwriteDurationInMillis(rootDuration)
  }

  rootNode._ranges = null
  return total
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
 * 5: the guid for this transaction, used to correlate across
 *    transactions
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
  const serializedTrace = this._serializeTrace()

  const trace = this
  if (!this.transaction.agent.config.simple_compression) {
    codec.encode(serializedTrace, respond)
  } else {
    setImmediate(respond, null, serializedTrace)
  }

  function respond(err, data) {
    if (err) {
      return callback(err, null, null)
    }

    return callback(null, trace._generatePayload(data), trace)
  }
}

/**
 * This is the synchronous version of Trace#generateJSON
 *
 * @returns {object} JSON payload
 */
Trace.prototype.generateJSONSync = function generateJSONSync() {
  const serializedTrace = this._serializeTrace()
  const shouldCompress = !this.transaction.agent.config.simple_compression
  const data = shouldCompress ? codec.encodeSync(serializedTrace) : serializedTrace
  return this._generatePayload(data)
}

/**
 * Generates the payload used in a trace harvest.
 *
 * @private
 * @param {string} data base64 string, from zlib.deflateSync
 * @returns {Array} The formatted payload.
 */
Trace.prototype._generatePayload = function _generatePayload(data) {
  let syntheticsResourceId = null
  if (this.transaction.syntheticsData) {
    syntheticsResourceId = this.transaction.syntheticsData.resourceId
  }

  const requestUri = this._getRequestUri()

  return [
    this.root.timer.start, // start
    this.transaction.getResponseTimeInMillis(), // response time
    this.transaction.getFullName(), // path
    requestUri, // request.uri
    data, // encodedCompressedData
    this.transaction.id, // guid
    null, // reserved for future use
    false, // forcePersist
    null, // xraySessionId
    syntheticsResourceId // synthetics resource id
  ]
}

/**
 * Returns the transaction URL if attribute is not excluded globally or
 * for transaction traces. Returns '/Unknown' if included but not known.
 *
 * The URI on a trace is a special attribute. It is included as a positional field,
 * not as an "agent attribute", to avoid having to decompress on the backend.
 * But it still needs to be gated by the same attribute exclusion/inclusion
 * rules so sensitive information can be removed.
 *
 * @returns {string} requestUri
 */
Trace.prototype._getRequestUri = function _getRequestUri() {
  const canAddUri = this.attributes.hasValidDestination(DESTINATIONS.TRANS_TRACE, REQUEST_URI_KEY)
  let requestUri = null // must be null if excluded
  if (canAddUri) {
    // obfuscate the path if config is set
    const url = urltils.obfuscatePath(this.transaction.agent.config, this.transaction.url)
    requestUri = url || UNKNOWN_URI_PLACEHOLDER
  }

  return requestUri
}

/**
 * Gets all children of a segment. This is only used in testing
 *
 * @param {number} id of segment
 * @returns {Array.<TraceSegment>} list of all segments that have the parentId of the segment
 */
Trace.prototype.getChildren = function getChildren(id) {
  const node = this.segments.find(id)
  return node?.children.map((child) => child.segment)
}

/**
 * This is perhaps the most poorly-documented element of transaction traces:
 * what do each of the segment representations look like prior to encoding?
 * Spelunking in the code for the other agents has revealed that each child
 * node is an array with the following field in the following order:
 *
 * 0: entry timestamp relative to transaction start time
 * 1: exit timestamp
 * 2: metric name
 * 3: parameters as a name -> value JSON dictionary
 * 4: any child segments
 *
 * Other agents include further fields in this. I haven't gotten to the bottom
 * of all of them (and Ruby, of course, sends marshalled Ruby object), but
 * here's what I know so far:
 *
 * in Java:
 * 5: class name
 * 6: method name
 *
 * in Python:
 * 5: a "label"
 *
 * FIXME: I don't know if it makes sense to add custom fields for Node. TBD
 */
Trace.prototype.toJSON = function toJSON() {
  const rootTimer = this.root.timer
  const resultDest = []
  const nodeStack = [this.segments.root]
  const destStack = [resultDest]

  while (nodeStack.length !== 0) {
    const node = nodeStack.pop()
    const destination = destStack.pop()
    const { segment, children } = node
    const start = segment.timer.startedRelativeTo(rootTimer)
    const duration = segment.getDurationInMillis()

    const childArray = []
    destination.push([start, start + duration, segment.name, segment.getAttributes(), childArray])

    // Push children in reverse so the first child is on top of the stack.
    for (let i = children.length - 1; i >= 0; --i) {
      const child = children[i]
      if (child.segment._collect && !child.segment.ignore) {
        nodeStack.push(child)
        destStack.push(childArray)
      }
    }
  }

  return resultDest[0]
}

/**
 * Serializes the trace into the expected JSON format to be sent.
 *
 * @private
 * @returns {Array} Serialized trace data.
 */
Trace.prototype._serializeTrace = function _serializeTrace() {
  const attributes = {
    agentAttributes: this.attributes.get(DESTINATIONS.TRANS_TRACE),
    userAttributes: this.custom.get(DESTINATIONS.TRANS_TRACE),
    intrinsics: this.intrinsics
  }

  const trace = [
    this.root.timer.start * FROM_MILLIS,
    {}, // moved to agentAttributes
    {
      // hint to RPM for how to display this trace's segments
      nr_flatten_leading: false
    }, // moved to userAttributes
    this.toJSON(),
    attributes,
    [] // FIXME: parameter groups
  ]

  // clear out segments
  this.segments = null
  return trace
}

module.exports = Trace
