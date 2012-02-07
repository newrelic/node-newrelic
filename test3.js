 var t = require('./lib/trace.js');
 tx = t.createTransaction();

 console.log(tx);

tr = new t.Tracer(tx);
console.log(tr.parentTracer);
tr2 = new t.Tracer(tx);
console.log(tr.parentTracer);

 tr2.finish();
 tr.finish();
 
 
 tx = t.createTransaction();
 console.log(tx);

tr = new t.Tracer(tx);
console.log(tr.parentTracer);
tr2 = new t.Tracer(tx);
console.log(tr.parentTracer);

 //tr2.finish();
 tr.finish();
 
