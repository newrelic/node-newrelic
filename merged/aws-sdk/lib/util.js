'use strict'
function grabLastUrlSegment(url = '/') {
  url = '' + url  // cast as string
  const lastSlashIndex = url.lastIndexOf('/')
  const lastItem = url.substr(lastSlashIndex + 1)

  return lastItem
}

module.exports = {
  grabLastUrlSegment
}
