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
var pg = require('pg');
var dotenv = require('dotenv');

//client id and client secret here, taken from .env
dotenv.load();

//connect to database
var conString = process.env.DATABASE_CONNECTION_URL;

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

app.get('/delphidata', function (req, res) {
    // initialize connection pool
    pg.connect(conString, function(err, client, done) {
      if(err) return console.log(err);

      var query = 'SELECT * FROM cdph_smoking_prevalence_in_adults_1984_2013';
      client.query(query, function(err, result) {
        // return the client to the connection pool for other requests to reuse
        done();

        res.writeHead("200", {'content-type': 'application/json'});
        res.end(JSON.stringify(result.rows));
      });
    });
  });

app.get('/delphi-education', function (req, res) {
    // initialize connection pool
    pg.connect(conString, function(err, client, done) {
      if(err) return console.log(err);

      var query = 'SELECT * FROM hhsa_san_diego_demographics_education_2012';
      client.query(query, function(err, result) {
        // return the client to the connection pool for other requests to reuse
        //console.log(JSON.stringify(result.rows));
        done();

        res.writeHead("200", {'content-type': 'application/json'});
        res.end(JSON.stringify(result));
      });
    });
  });

app.get('/delphi-housing-info', function (req, res) {
    // initialize connection pool
    pg.connect(conString, function(err, client, done) {
      if(err) return console.log(err);

      var query = 'SELECT * FROM hhsa_san_diego_demographics_housing_characteristics_2012';
      client.query(query, function(err, result) {
        // return the client to the connection pool for other requests to reuse
        //console.log(JSON.stringify(result.rows));
        done();

        res.writeHead("200", {'content-type': 'application/json'});
        res.end(JSON.stringify(result.rows));
      });
    });
  });

app.get('/delphi-home-value', function (req, res) {
    // initialize connection pool
    pg.connect(conString, function(err, client, done) {
      if(err) return console.log(err);

      var query = 'SELECT * FROM hhsa_san_diego_demographics_home_value_2012';
      client.query(query, function(err, result) {
        // return the client to the connection pool for other requests to reuse
        //console.log(JSON.stringify(result.rows));
        done();

        res.writeHead("200", {'content-type': 'application/json'});
        res.end(JSON.stringify(result.rows));
      });
    });
  });

exports = module.exports = app;