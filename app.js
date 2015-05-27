var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var path = require('path');
var handlebars = require('express-handlebars');
var logger = require('morgan');
var bodyParser = require('body-parser');
var async = require('async');
var app = express();
var gm = require('googlemaps');

// Configure the template engine
app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));

app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat',
                  saveUninitialized: true,
                  resave: true}));

app.get('/', function(req, res){
  res.render('index');
});

exports = module.exports = app;