/**
 * Created by lmarkus on 11/24/14.
 */
var routes = function(router){
  router.get('/', function(req,res){
    res.send('kraken')
    res.end()
  })

  router.get('/foo', function(req,res) {
    res.send('kraken-foo')
    res.end()
  })
}

module.exports = routes
