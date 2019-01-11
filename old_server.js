var express = require('express');
var forceSSL = require('express-force-ssl');
var minify = require('express-minify');
var fs = require('fs');
var http = require('http');
var https = require('https');
 
var ssl_options = {
  key: fs.readFileSync('../ssl/privkey.pem'),
  cert: fs.readFileSync('../ssl/fullchain.pem'),
  index: "index.html"
};
 
var app = express();
var server = http.createServer(app);
var secureServer = https.createServer(ssl_options, app);
 
//app.use(minify({cache: __dirname + '/cache'}));
app.use(forceSSL);
//app.use(compression());
//app.use(minify({cache: __dirname + '/cache'}));
app.use(function (req, res, next) {
  if(req.url != '/server.js') {
    next();
  }
  else {
    res.redirect('/');
  }
});

app.use(express.static(__dirname));
 
secureServer.listen(443)
server.listen(3000)


