'use strict'
function grabLastUrlSegment(url = '/') {
  // cast URL as string, and an empty
  // string for null, undefined, NaN etc.
  url = '' + (url || '/')
  const lastSlashIndex = url.lastIndexOf('/')
  const lastItem = url.substr(lastSlashIndex + 1)

  return lastItem
}

module.exports = {
  grabLastUrlSegment
}
