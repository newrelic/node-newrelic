/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const symbols = require('../../symbols')

function Context(segment) {
  this.segments = [segment]
}

Context.prototype = Object.create(null)

Context.prototype.branch = function branch() {
  return this.segments.push(null) - 1
}

function Contextualizer(idx, context) {
  this.parentIdx = -1
  this.idx = idx
  this.context = context
  this.child = null
}

module.exports = Contextualizer

/**
 * Manually bind the async context to every
 * child within the promise chain
 *
 * @param {object} ctxlzr current promise
 * @param {object} next the next link in promise chain
 * @returns {void}
 */
function bindChild(ctxlzr, next) {
  // If prev has one child already, branch the context and update the child.
  if (ctxlzr.child) {
    // When the branch-point is the 2nd through nth link in the chain, it is
    // necessary to track its segment separately so the branches can parent
    // their segments on the branch-point.
    if (ctxlzr.parentIdx !== -1) {
      ctxlzr.idx = ctxlzr.context.branch()
    }

    // The first child needs to be updated to have its own branch as well. And
    // each of that child's children must be updated with the new parent index.
    // This is the only non-constant-time action for linking, but it only
    // happens with branching promise chains specifically when the 2nd branch
    // is added.
    //
    // Note: This does not account for branches of branches. That may result
    // in improperly parented segments.
    let parent = ctxlzr
    let child = ctxlzr.child
    const branchIdx = ctxlzr.context.branch()
    do {
      child.parentIdx = parent.idx
      child.idx = branchIdx
      parent = child
      child = child.child
    } while (child)

    // We set the child to something falsey that isn't `null` so we can
    // distinguish between having no child, having one child, and having
    // multiple children.
    ctxlzr.child = false
  }

  // If this is a branching link then create a new branch for the next promise.
  // Otherwise, we can just piggy-back on the previous link's spot.
  const idx = ctxlzr.child === false ? ctxlzr.context.branch() : ctxlzr.idx

  // Create a new context for this next promise.
  next[symbols.context] = new Contextualizer(idx, ctxlzr.context)
  next[symbols.context].parentIdx = ctxlzr.idx

  // If this was our first child, remember it in case we have a 2nd.
  if (ctxlzr.child === null) {
    ctxlzr.child = next[symbols.context]
  }
}

/**
 * Binds segment to the entire promise chain
 *
 * @param {Function} prev previous function in chain
 * @param {Function} next next function in chain
 * @param {object} segment proper segment to bind
 * @returns {void}
 */
Contextualizer.link = function link(prev, next, segment) {
  let ctxlzr = prev && prev[symbols.context]
  if (ctxlzr && !ctxlzr.isActive()) {
    ctxlzr = prev[symbols.context] = null
  }

  if (ctxlzr) {
    bindChild(ctxlzr, next)
  } else if (segment) {
    // This next promise is the root of a chain. Either there was no previous
    // promise or the promise was created out of context.
    next[symbols.context] = new Contextualizer(0, new Context(segment))
  }
}

Contextualizer.prototype = Object.create(null)

/**
 * Checks if segment is currently active
 *
 * @returns {boolean} if segment is active
 */
Contextualizer.prototype.isActive = function isActive() {
  const segments = this.context.segments
  const segment = segments[this.idx] || segments[this.parentIdx] || segments[0]
  return segment && segment.transaction.isActive()
}

/**
 * Gets the segment at the appropriate index.
 * If there is none it will get the segment at the parent index or the first one
 * then assign to current index.
 *
 * @returns {object} segment by idx or parentIdx or the first one
 */
Contextualizer.prototype.getSegment = function getSegment() {
  const segments = this.context.segments
  let segment = segments[this.idx]
  if (segment == null) {
    segment = segments[this.idx] = segments[this.parentIdx] || segments[0]
  }
  return segment
}

/**
 * Sets the set to the appropriate index
 *
 * @param {object} segment segment to assign to index
 * @returns {object} same segment passed in
 */
Contextualizer.prototype.setSegment = function setSegment(segment) {
  return (this.context.segments[this.idx] = segment)
}

/**
 * Propagates the segment to the finally function
 *
 * @param {Function} prom current promise
 * @returns {Function} current promise or wrapped finally that will propagate the segment
 */
Contextualizer.prototype.continue = function continueContext(prom) {
  const self = this
  const nextContext = prom[symbols.context]
  if (!nextContext) {
    return prom
  }

  // If we have `finally`, use that to sneak our context update.
  if (typeof prom.finally === 'function') {
    return prom.finally(__NR_continueContext)
  }

  // eslint-disable-next-line camelcase
  function __NR_continueContext() {
    self.setSegment(nextContext.getSegment())
  }
}
