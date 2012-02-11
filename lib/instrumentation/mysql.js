exports.initialize = function(agent, trace, mysql) {
    var Client = mysql.Client;
    var db = require('../database');
    
    var _query = Client.prototype.query;
    Client.prototype.query = function(sql, callback) {

        var tx = agent.getTransaction();
        if (!tx) {
            return _query.apply(this, arguments);
        }
        var ps = db.parseSql(sql);
        var tracer = new trace.Tracer(tx, ps.recordMetrics);
        tracer.sql = sql;
        var wrapper = function() {
            tracer.finish();
            callback.apply(this, arguments);
        };
        return _query.apply(this, [sql, wrapper]);        
    };
    
    
    /*
    Client.prototype.query = function(sql, callback) {
        var tx = agent.getTransaction();
        if (!tx) {
            return _query.apply(this, arguments);
        }
        id++;
        var time = 0;
        var ps = db.parseSql(sql);
        var timer = new trace.Timer();
        var tracer = new trace.Tracer(tx, ps.recordMetrics);
        tracer.sql = sql;
        var wrapper = function() {
            tracer.finish();
            timer.stop();
            console.log(id + " " + timer.getDurationInMillis() + " " + time);
            callback.apply(this, arguments);
        };
        var timer2 = new trace.Timer();
        var theQuery = _query.apply(this, [sql, wrapper]);
        timer2.stop();
        time += timer2.getDurationInMillis();
        var handlePacket = theQuery._handlePacket;
        theQuery._handlePacket = function() {
//        	console.log("handle packets");
        	var packetTimer = new trace.Timer();
        	handlePacket.apply(this, arguments);
        	packetTimer.stop();
        	time += packetTimer.getDurationInMillis();
        };
        return theQuery;
    };
     */
};