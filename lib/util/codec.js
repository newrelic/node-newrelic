/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const stringify = require('json-stringify-safe')
const zlib = require('zlib')

module.exports = {
  /**
   * Take in an object literal, and deflate and then Base64 encode it.
   *
   * zlib works with streams, so this must be used asynchronously.
   *
   * @param {object} data
   *  The data to encode.
   * @param {Function} callback
   *  The callback to take the results. The first parameter is any errors from
   *  encoding, and the second parameter is the encoded data object.
   */
  encode: function encode(data, callback) {
    try {
      zlib.deflate(stringify(data), function cbDeflate(err, raw) {
        if (err) {
          return callback(err)
        }

        return callback(null, raw.toString('base64'))
      })
    } catch (err) {
      return callback(err)
    }
  },

  /**
   * Base64 decode a string, decompress it, and then turn the results back into
   * a JavaScript object.
   *
   * zlib works with streams, so this must be used asynchronously.
   *
   * @param {object} encoded
   *  The data to decode.
   * @param {Function} callback
   *  The callback to take the results. The first parameter is any errors from
   *  decoding, and the second parameter is the decoded data object.
   */
  decode: function decode(encoded, callback) {
    zlib.inflate(Buffer.from(encoded, 'base64'), function cbInflate(err, raw) {
      if (err) {
        return callback(err)
      }

      let json
      try {
        json = JSON.parse(raw)
      } catch (error) {
        return callback(error)
      }

      return callback(null, json)
    })
  },

  /**
   * Take in an object literal, and deflate and then Base64 encode it.
   *
   * This is the synchronous version.
   *
   * @param {object} data
   *  The data to encode.
   */
  encodeSync: function encodeSync(data) {
    return zlib.deflateSync(stringify(data)).toString('base64')
  },

  /**
   * Base64 decode a string, decompress it, and then turn the results back into
   * a JavaScript object.
   *
   * This is the synchronous version.
   *
   * @param {object} encoded
   *  The data to decode.
   */
  decodeSync: function decodeSync(encoded) {
    return JSON.parse(zlib.inflateSync(Buffer.from(encoded, 'base64')))
  }
}
