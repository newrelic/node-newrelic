'use strict'
class ProxyGrpc {
  constructor(grpcLibrary = '@grpc/grpc-js') {
    this.library = require(grpcLibrary)

    // add methods or objets from base grpc class that we need as needed
    this.credentials = this.library.credentials
    this.Metadata = this.library.Metadata
    this.loadPackageDefinition = this.library.loadPackageDefinition
    this.status = this.library.status
    this.Server = this.library.Server
    this.ServerCredentials = this.library.ServerCredentials
  }
}
module.exports = (new ProxyGrpc)
