/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

class ExclusiveCalculator {
  constructor(root, trace) {
    this.node = trace.getNode(root.id)
    // use a second stack to do a post-order traversal
    this.parentStack = []
  }

  /**
   * Kicks off the exclusive duration calculation.  This is performed
   * using a depth first, postorder traversal over the tree recursively
   *
   * @param {Node} node to process duration and children
   */
  process(node = this.node) {
    const { children, segment } = node
    if (children.length === 0) {
      segment._exclusiveDuration = segment.getDurationInMillis()
      if (this.parentStack.length) {
        this.finishLeaf(segment.timer.toRange())
      }
    } else {
      this.parentStack.push({
        childrenLeft: children.length,
        segment,
        childPairs: []
      })
      for (let i = children.length - 1; i >= 0; --i) {
        this.process(children[i])
      }
    }
  }

  /**
   * Updates the immediate parent in the parent stack that a leaf node has
   * been processed.  If the parent isn't expecting any more children to
   * be processed, it pops the stack and propagates the processing to
   * more distant predecessors.
   *
   * @param {Array} childRange An array of start and end time for the finished leaf node
   */
  finishLeaf(childRange) {
    let parent = this.parentStack[this.parentStack.length - 1]
    // push the current segment's range pair up to the parent's child pairs
    parent.childPairs = merge(parent.childPairs, [childRange])
    // decrement the number of children expected for the current parent; process the
    // parent if it is not expecting any further children to finish (i.e. the number
    // of children left to process is 0).
    while (--parent.childrenLeft === 0) {
      // pull off the finished parent and assign the exclusive duration
      const { segment: finishedParent, childPairs } = this.parentStack.pop()
      const timer = finishedParent.timer
      const finishedEnd = timer.getDurationInMillis() + timer.start
      let duration = finishedParent.getDurationInMillis()
      for (let i = 0; i < childPairs.length; ++i) {
        const pair = childPairs[i]
        // since these are non-overlapping and ordered by start time, the first one
        // to start after the parent's end marks the end of the segments we care
        // about.
        if (pair[0] >= finishedEnd) {
          break
        }
        duration -= Math.min(pair[1], finishedEnd) - pair[0]
      }

      finishedParent._exclusiveDuration = duration
      parent = this.parentStack[this.parentStack.length - 1]
      // since the parent was potentially a child of another segment, we need to
      // rerun this for the parent's parent till we hit a parent with children yet
      // to be processed.
      if (parent) {
        // merge the current child segments in with the finished parent's range
        const inserted = merge(childPairs, [finishedParent.timer.toRange()])
        // merge the finished parent's merged range into its parent's range
        parent.childPairs = merge(parent.childPairs, inserted)
      } else {
        // in the case where the parent doesn't exist, we are done and can break out.
        break
      }
    }
  }
}

function merge(first, second) {
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

module.exports = ExclusiveCalculator
