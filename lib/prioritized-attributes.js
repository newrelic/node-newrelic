/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Config = require('./config')
const logger = require('./logger').child({ component: 'attributes' })
const isValidType = require('./util/attribute-types')
const byteUtils = require('./util/byte-limit')
const properties = require('./util/properties')

const ATTRIBUTE_PRIORITY = {
  HIGH: Infinity,
  LOW: -Infinity
}

class PrioritizedAttributes {
  constructor(scope, limit = Infinity) {
    this.filter = makeFilter(scope)
    this.limit = limit

    this.attributes = new Map()
  }

  isValidLength(str) {
    return typeof str === 'number' || byteUtils.isValidLength(str, 255)
  }

  _set(destinations, key, value, truncateExempt, priority) {
    this.attributes.set(key, { value, destinations, truncateExempt, priority })
  }

  get(dest) {
    const attrs = Object.create(null)

    for (const [key, attr] of this.attributes) {
      if (!(attr.destinations & dest)) {
        continue
      }

      attrs[key] =
        typeof attr.value === 'string' && !attr.truncateExempt
          ? byteUtils.truncate(attr.value, 255)
          : attr.value
    }

    return attrs
  }

  has(key) {
    this.attributes.has(key)
  }

  reset() {
    this.attributes = new Map()
  }

  addAttribute(
    destinations,
    key,
    value,
    truncateExempt = false,
    priority = ATTRIBUTE_PRIORITY.HIGH
  ) {
    const existingAttribute = this.attributes.get(key)

    let droppableAttributeKey = null
    if (!existingAttribute && this.attributes.size === this.limit) {
      droppableAttributeKey = this._getDroppableAttributeKey(priority)

      if (!droppableAttributeKey) {
        logger.debug(
          `Maximum number of custom attributes have been added.
          Dropping attribute ${key} with ${value} type.`
        )

        return
      }
    }

    if (existingAttribute && priority < existingAttribute.priority) {
      logger.debug("incoming priority for '%s' is lower than existing, not updating.", key)
      logger.trace(
        '%s attribute retained value: %s, ignored value: %s',
        key,
        existingAttribute.value,
        value
      )
      return
    }

    if (!isValidType(value)) {
      logger.debug(
        'Not adding attribute %s with %s value type. This is expected for undefined' +
          'attributes and only an issue if an attribute is not expected to be undefined' +
          'or not of the type expected.',
        key,
        typeof value
      )
      return
    }

    if (!this.isValidLength(key)) {
      logger.warn('Length limit exceeded for attribute name, not adding: %s', key)
      return
    }

    // Only set the attribute if at least one destination passed
    const validDestinations = this.filter(destinations, key)
    if (!validDestinations) {
      return
    }

    if (droppableAttributeKey) {
      logger.trace(
        'dropping existing lower priority attribute %s ' + 'to add higher priority attribute %s',
        droppableAttributeKey,
        key
      )

      this.attributes.delete(droppableAttributeKey)
    }

    this._set(validDestinations, key, value, truncateExempt, priority)
  }

  addAttributes(destinations, attrs) {
    for (const key in attrs) {
      if (properties.hasOwn(attrs, key)) {
        this.addAttribute(destinations, key, attrs[key])
      }
    }
  }

  /**
   * Returns true if a given key is valid for any of the
   * provided destinations.
   *
   * @param {DESTINATIONS} destinations
   * @param {string} key
   */
  hasValidDestination(destinations, key) {
    const validDestinations = this.filter(destinations, key)
    return !!validDestinations
  }

  _getDroppableAttributeKey(incomingPriority) {
    // There will never be anything lower priority to drop
    if (incomingPriority === ATTRIBUTE_PRIORITY.LOW) {
      return null
    }

    this.lastFoundIndexCache = this.lastFoundIndexCache || Object.create(null)
    const lastFoundIndex = this.lastFoundIndexCache[incomingPriority]

    // We've already dropped all items lower than incomingPriority.
    // We can honor the cache because at the point by which we've dropped
    // all lower priority items, due to being at max capacity, there will never be another
    // lower-priority item added. Lower priority items are unable to drop higher priority items.
    if (lastFoundIndex === -1) {
      return null
    }

    // We can't reverse iterate w/o creating an array that will iterate,
    // so we just iterate forward stopping once we've checked the last cached index.
    let lowerPriorityAttributeName = null
    let foundIndex = -1

    let index = 0
    for (const [key, attribute] of this.attributes) {
      // Don't search past last found lower priority item.
      // At the point of dropping items for this priority,
      // lower priority items will never be added.
      if (lastFoundIndex && index > lastFoundIndex) {
        break
      }

      if (attribute.priority < incomingPriority) {
        lowerPriorityAttributeName = key
        foundIndex = index
      }

      index++
    }

    // Item may not get dropped, so we simply store the index as
    // an upper maximum and allow a future pass to clear out.
    this.lastFoundIndexCache[incomingPriority] = foundIndex

    return lowerPriorityAttributeName
  }
}

function makeFilter(scope) {
  const { attributeFilter } = Config.getInstance()
  if (scope === 'transaction') {
    return (d, k) => attributeFilter.filterTransaction(d, k)
  } else if (scope === 'segment') {
    return (d, k) => attributeFilter.filterSegment(d, k)
  }
}

module.exports = {
  PrioritizedAttributes: PrioritizedAttributes,
  ATTRIBUTE_PRIORITY: ATTRIBUTE_PRIORITY
}
