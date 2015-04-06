'use strict'

var zlib = require('zlib')

module.exports = {
  /**
   * zlib works with streams, so this must be used asynchronously.
   *
   * Take in an object literal, and deflate and then Base64 encode it.
   *
   * @param {string} params The parameters object.
   * @param {Function} callback The callback to take the results.
   *                            The first parameter is any errors
   *                            from decoding, and the second
   *                            parameter is the encoded parameters
   *                            object.
   */
  encode: function encode(data, callback) {
    try {
      zlib.deflate(JSON.stringify(data), function cb_deflate(err, raw) {
        if (err) return callback(err)

        return callback(null, raw.toString('base64'))
      })
    } catch (err) {
      return callback(err)
    }
  },

  /**
   * zlib works with streams, so this must be used asynchronously.
   *
   * Base64 decode a string, decompress it, and then turn the
   * results back into a JavaScript object.
   *
   * @param {string} encoded The encoded data.
   * @param {Function} callback The callback to take the results,
   *                            1st parameter is any errors from
   *                            decoding, 2nd parameter is the
   *                            decoded data object.
   */
  decode: function decode(encoded, callback) {
    zlib.inflate(new Buffer(encoded, 'base64'), function cb_inflate(err, raw) {
      if (err) return callback(err)

      try {
        return callback(null, JSON.parse(raw))
      } catch (error) {
        return callback(error)
      }
    })
  }
}
