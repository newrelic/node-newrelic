'use strict'

var path = require('path')
var test = require('tap').test
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')


/*
 * CONSTANTS
 */
var SESSION_SECRET = 'hecknope'
var SESSION_ID = 'deadbeef'
var ROOM_ID = 'abad1d3a'
var DB_INDEX = 1


/* Ensure Passport session is set up
 */
function restrict(req, res, next) {
  if (req.isAuthenticated()) return next()

  res.redirect('/')
}

/* hits Redis
 */
function getRoomInfo(req, res, client, next) {
  client.hgetall('rooms:' + req.params.id + ':info', function (err, room) {
    if (!err && room && Object.keys(room).length) return next(room)

    res.redirect('back')
  })
}

/* hits Redis for a set
 */
function getUsersInRoom(req, client, next) {
  client.smembers('rooms:' + req.params.id + ':online', function (err, online) {
    var users = []

    online.forEach(function cb_forEach(userKey) {
      client.get('users:' + userKey + ':status', function (err, status) {
        var msnData  = userKey.split(':')
          , username = msnData.length > 1 ? msnData[1] : msnData[0]
          , provider = msnData.length > 1 ? msnData[0] : 'twitter'


        users.push({
          username : username,
          provider : provider,
          status   : status || 'available'
        })
      })
    })

    next(users)
  })
}

/* hits Redis
 */
function getPublicRoomsInfo(client, next) {
  client.smembers('test:public:rooms', function (err, publicRooms) {
    var rooms = []
      , len   = publicRooms.length


    if (!len) next([])

    publicRooms.forEach(function cb_forEach(roomKey) {
      client.hgetall('rooms:' + roomKey + ':info', function (err, room) {
        if (!err && room && Object.keys(room).length) {
          rooms.push({
            key    : room.key || room.name, // temp
            name   : room.name,
            online : room.online || 0
          })

          if (rooms.length === len) next(rooms)
        }
        else {
          len -= 1
        }
      })
    })
  })
}

/* hits Redis
 */
function getUserStatus(user, client, next) {
  client.get('users:' + user.provider + ":" + user.username + ':status',
             function (err, status) {
    if (!err && status) return next(status)

    next('available')
  })
}

/* adds data to res for Jade
 */
function enterRoom(req, res, room, users, rooms, status) {
  res.locals({
    room  : room,
    rooms : rooms,
    user  : {
      nickname : req.user.username,
      provider : req.user.provider,
      status   : status
    },
    users_list : users
  })

  res.render('room')
}

/* set up Express, including scary route
 */
function bootstrapExpress(client) {
  var express    = require('express')
    , passport   = require('passport')
    , RedisStore = require('connect-redis')(express)
    , app        = express()


  passport.deserializeUser(function cb_deserializeUser(id, done) {
    done(null, {provider : 'twitter', username : id})
  })

  app.set('view engine', 'jade')
  app.set('views', path.join(__dirname, 'views'))

  app.use(express.bodyParser())
  app.use(express.cookieParser(SESSION_SECRET))
  app.use(express.session({
    key   : 'test',
    store : new RedisStore({client: client, db: DB_INDEX})
  }))
  app.use(passport.initialize())
  app.use(passport.session())
  app.use(app.router)

  app.get('/:id', restrict, function (req, res) {
    getRoomInfo(req, res, client, function (room) {
      getUsersInRoom(req, client, function (users) {
        getPublicRoomsInfo(client, function (rooms) {
          getUserStatus(req.user, client, function (status) {
            enterRoom(req, res, room, users, rooms, status)
          })
        })
      })
    })
  })

  return app
}

/* Create default session data in the form the app is expecting.
 */
function defaultSession() {
  return {
    cookie : {
      originalMaxAge : null,
      expires        : null,
      httpOnly       : true,
      path           : '/'
    },
    passport : {
      user : 'othiym23'
    }
  }
}

/* Prepopulate enough data that the whole cycle will run.
 */
function populate(client, next) {
  client.sadd('rooms:' + ROOM_ID + ':online', 'twitter:othiym23')
  client.sadd('rooms:' + ROOM_ID + ':online', 'twitter:izs')
  client.sadd('rooms:' + ROOM_ID + ':online', 'twitter:drugleaf')

  client.set('users:twitter:othiym23:status', 'available')
  client.set('users:twitter:izs:status',      'available')
  client.set('users:twitter:drugleaf:status', 'available')

  client.sadd('test:public:rooms', ROOM_ID)

  client.hmset('rooms:' + ROOM_ID + ':info', {
    key    : ROOM_ID,
    name   : 'test room',
    online : 3
  })

  client.set('sess:' + SESSION_ID, JSON.stringify(defaultSession()), next)
}

/* create a signed cookie containing the session ID.
 */
function makeCookie() {
  var cookie = require('cookie')
    , signer = require('cookie-signature')


  return cookie.serialize('test', 's:' + signer.sign(SESSION_ID, SESSION_SECRET))
}


/**
 **
 ** ACTUAL TEST
 **
 **/
test("Express 3 with Redis support", {timeout : Infinity}, function (t) {
  t.plan(37)

  var agent        = helper.instrumentMockedAgent()
    , redis        = require('redis')
    , createServer = require('http').createServer
    , request      = require('request')


  // need to capture parameters
  agent.config.capture_params = true

  var self = this
  helper.bootstrapRedis(DB_INDEX, function cb_bootstrapRedis(error, service) {
    if (error) {
      t.fail(error)
      return t.end()
    }

    var client = redis.createClient(params.redis_port, params.redis_host)
      , server = createServer(bootstrapExpress(client)).listen(31337)


    self.tearDown(function cb_tearDown() {
      server.close(function cb_close() {
        client.end()
        helper.unloadAgent(agent)
      })
    })

    populate(client, function (error) {
      if (error) {
        t.fail(error)
        return t.end()
      }

      agent.on('transactionFinished', function verifier(transaction) {
        var key
        var trace = transaction.trace
        var children = trace.root.children || []
        t.equal(trace.root.children.length, 1, "root has one child")

        var web = trace.root.children[0] || {}
        children = web.children || []
        t.equal(web.name, 'WebTransaction/Expressjs/GET//:id',
                "first segment is web transaction")
        t.equal(web.children.length, 2, "web node has two children")

        var get = children[0] || {}
        key = (get.parameters || {}).key
        t.equal(get.name, 'Datastore/operation/Redis/get', "first child segment is get")
        t.equal(key, '"sess:' + SESSION_ID + '"',
                "operation is session load")
        t.ok((get.children || {}).length >= 1, "get should have a callback segment")

        var hgetall = children[1] || {}
        key = (hgetall.parameters || {}).key

        children = hgetall.children[0].children || []
        t.equal(hgetall.name, 'Datastore/operation/Redis/hgetall',
                "second child segment is hgetall")
        t.equal(key, '"rooms:' + ROOM_ID + ':info"',
                "operation is room info load")
        t.equal(
          children.length, 1,
          "hgetall callback has one child"
        )

        var smembers = children[0] || {}
        key = (smembers.parameters || {}).key
        children = smembers.children[0].children || []
        t.equal(smembers.name, 'Datastore/operation/Redis/smembers',
                "hgetall child is smembers")
        t.equal(key, '"rooms:' + ROOM_ID + ':online"',
                "operation is load set of online users")
        t.equal(children.length, 4, "smembers has four children")

        // Redis roundtrip isn't deterministic
        var users = /\"users:twitter:(drugleaf|othiym23|izs):status\"/

        get = children[0] || {}
        key = (get.parameters || {}).key
        t.equal(get.name, 'Datastore/operation/Redis/get',
                "first smembers child is get")
        t.like(key, users, "fetched status of user")
        t.ok((get.children || {}).length >= 1, "get should have a callback segment")

        get = children[1] || {}
        key = (get.parameters || {}).key
        t.equal(get.name, 'Datastore/operation/Redis/get',
                "second smembers child is get")
        t.like(key, users, "fetched status of user")
        t.ok((get.children || {}).length >= 1, "get should have a callback segment")

        get = children[2] || {}
        key = (get.parameters || {}).key
        t.equal(get.name, 'Datastore/operation/Redis/get',
                "third smembers child is get")
        t.like(key, users, "fetched status of user")
        t.ok((get.children || {}).length >= 1, "get should have a callback segment")

        smembers = children[3] || {}
        key = (smembers.parameters || {}).key
        children = smembers.children[0].children || []
        t.equal(smembers.name, 'Datastore/operation/Redis/smembers',
                "fourth child is smembers")
        t.equal(key, '"test:public:rooms"',
                "operation is load set of public rooms")
        t.equal(children.length, 1, "smembers has one child")

        hgetall = children[0] || {}
        key = (hgetall.parameters || {}).key
        children = hgetall.children || []
        t.equal(hgetall.name, 'Datastore/operation/Redis/hgetall',
                "child segment is hgetall")
        t.equal(key, '"rooms:' + ROOM_ID + ':info"',
                "operation is room info load")
        t.ok(children.length >= 1, "hgetallhave a callback segment")

        get = children[0].children[0] || {}
        key = (get.parameters || {}).key
        children = get.children[0].children || []
        t.equal(get.name, 'Datastore/operation/Redis/get', "first hgetall child is get")
        t.equal(key, '"users:twitter:othiym23:status"',
                "fetched status of othiym23")
        t.ok(children.length >= 2, "get has two children")

        var view = children[0] || {}
        t.equal(view.name, 'View/room/Rendering', "get child is render of room view")
        t.equal((view.children || {}).length, 0, "has no children")

        var setex = children[1] || {}
        key = (setex.parameters || {}).key
        t.equal(setex.name, 'Datastore/operation/Redis/setex', "view child is setex")
        t.equal(key, '"sess:' + SESSION_ID + '"',
                "updated session status")
        t.equal((setex.children || {}).length, 1, "setex has a callback segment")
      })

      var jar = request.jar()
      jar.add(request.cookie(makeCookie()))
      request({url : 'http://localhost:31337/' + ROOM_ID, jar : jar},
              function (error, response, body) {
        if (error) {
          t.fail(error)
          return t.end()
        }

        t.equal(response.statusCode, 200, "status was OK")
        t.ok(body, "got a response from the server")
      })
    })
  })
})
