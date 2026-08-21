/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('../logger.js').child({ component: 'attributes' })
const isValidType = require('../util/attribute-types.js')
const { Attributes } = require('./index.js')

const ATTRIBUTE_PRIORITY = {
  HIGH: Infinity,
  LOW: -Infinity
}

class PrioritizedAttributes extends Attributes {
  #logger

  constructor(
    scope,
    limit = Infinity,
    { logger = defaultLogger, valueLengthLimit = 256 } = {}
  ) {
    super({ scope, limit, valueLengthLimit, logger })
    this.#logger = logger
  }

  _set(destinations, key, value, truncateExempt, priority) {
    this.attributes[key] = { value, destinations, truncateExempt, priority }
  }

  addAttribute(
    destinations,
    key,
    value,
    truncateExempt = false,
    priority = ATTRIBUTE_PRIORITY.HIGH
  ) {
    const existingAttribute = this.attributes[key]

    let droppableAttributeKey = null
    if (!existingAttribute && this.attributeCount === this.limit) {
      droppableAttributeKey = this._getDroppableAttributeKey(priority)

      if (!droppableAttributeKey) {
        this.#logger.debug(
          `Maximum number of custom attributes have been added.
          Dropping attribute ${key} with ${value} type.`
        )

        return
      }
    }

    if (existingAttribute && priority < existingAttribute.priority) {
      this.#logger.debug("incoming priority for '%s' is lower than existing, not updating.", key)
      this.#logger.trace(
        '%s attribute retained value: %s, ignored value: %s',
        key,
        existingAttribute.value,
        value
      )
      return
    }

    if (!isValidType(value)) {
      this.#logger.debug(
        'Not adding attribute %s with %s value type. This is expected for undefined' +
          'attributes and only an issue if an attribute is not expected to be undefined' +
          'or not of the type expected.',
        key,
        typeof value
      )
      return
    }

    if (!this.isValidLength(key)) {
      this.#logger.warn('Length limit exceeded for attribute name, not adding: %s', key)
      return
    }

    // Only set the attribute if at least one destination passed
    const validDestinations = this.filter(destinations, key)
    if (!validDestinations) {
      return
    }

    if (droppableAttributeKey) {
      this.#logger.trace(
        'dropping existing lower priority attribute %s ' + 'to add higher priority attribute %s',
        droppableAttributeKey,
        key
      )

      delete this.attributes[droppableAttributeKey]
      this.attributeCount -= 1
    }

    if (!existingAttribute) {
      this.attributeCount += 1
    }
    this._set(validDestinations, key, value, truncateExempt, priority)
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
    for (const key in this.attributes) {
      // Don't search past last found lower priority item.
      // At the point of dropping items for this priority,
      // lower priority items will never be added.
      if (lastFoundIndex && index > lastFoundIndex) {
        break
      }

      if (this.attributes[key].priority < incomingPriority) {
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

module.exports = {
  PrioritizedAttributes,
  ATTRIBUTE_PRIORITY
}
