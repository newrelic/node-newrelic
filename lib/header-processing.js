/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const REQUEST_START_HEADER = 'x-request-start'
const QUEUE_HEADER = 'x-queue-start'
const CONTENT_LENGTH_REGEX = /^Content-Length$/i

/**
 * Extracts queue time from the incoming request headers.
 *
 * Queue time is provided by certain providers by stamping the request
 * header with the time the request arrived at the router.
 *
 * @param {*} logger
 * @param {*} requestHeaders
 */
function getQueueTime(logger, requestHeaders) {
  const headerValue = requestHeaders[REQUEST_START_HEADER] || requestHeaders[QUEUE_HEADER]
  if (!headerValue) {
    return null
  }

  const split = headerValue.split('=')
  const rawQueueTime = split.length > 1 ? split[1] : headerValue

  const parsedQueueTime = parseFloat(rawQueueTime)
  if (isNaN(parsedQueueTime)) {
    logger.warn('Queue time header parsed as NaN. See trace level log for value.')

    // This header can hold up to 4096 bytes which could quickly fill up logs.
    // Do not log a level higher than debug.
    logger.trace('Queue time: %s', rawQueueTime)

    return null
  }

  return convertUnit(parsedQueueTime)
}

function convertUnit(time) {
  let convertedTime = time
  if (convertedTime > 1e18) {
    // nano seconds
    convertedTime = convertedTime / 1e6
  } else if (convertedTime > 1e15) {
    // micro seconds
    convertedTime = convertedTime / 1e3
  } else if (convertedTime < 1e12) {
    // seconds
    convertedTime = convertedTime * 1e3
  }

  return convertedTime
}

/**
 * Returns the value of the Content-Length header
 *
 * If no header is found, returns -1
 *
 * @param {*} headers
 */
function getContentLengthFromHeaders(headers) {
  const contentLength = -1
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (CONTENT_LENGTH_REGEX.test(headerName)) {
      return headerValue
    }
  }
  return contentLength
}

module.exports = {
  getQueueTime,
  getContentLengthFromHeaders
}
