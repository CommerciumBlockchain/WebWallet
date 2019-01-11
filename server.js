var express = require('express');
var bodyParser= require('body-parser');
var app=express();

app.use('/', express.static(__dirname + '/'));
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({
    extended: true
}));

app.get('/', (req,res)=>{
    res.sendFile('index.html');
});

var server = require('https');
var fs = require('fs');
var certRoot = '../ssl/';
var options = {
    //ca: fs.readFileSync('ca.pem'),
    cert: fs.readFileSync(certRoot + 'fullchain.pem'),
    key: fs.readFileSync(certRoot + 'privkey.pem'),
};
 
server.createServer(options, app).listen(443, function(){
    console.log('[server.js] listening on port 443');
});
