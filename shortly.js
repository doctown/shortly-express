var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieSession = require('cookie-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'pssssst',
  resave: false,
  saveUninitialized: true
}));

// redirects user to login page if session is not valid
var restrict = function (req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
};

app.get('/', restrict, function(req, res) {
  res.render('index'); 
});

app.get('/create', restrict, function(req, res) {
  res.render('index');
});

app.get('/links', restrict, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  // check that username and password authentiv=cate to the database 
  db.knex('users').where({username: username, password: password}).then(function(result) {
    // TODO: Create new session id and save in database for user
    if (result.length > 0) {
      
      req.session.regenerate(function() {
        req.session.user = username;
        // redirect user to home page
        res.status(200).redirect('/');
      });
        
    } else { // then create a session
      res.status(200).redirect('/login');
    }
  });
});

app.get('/login', function(req, res) {
  res.send('<form method="post" action="/login">' +
  '<p>' +
    '<label>Username:</label>' +
    '<input type="text" name="username">' +
  '</p>' +
  '<p>' +
    '<label>Password:</label>' +
    '<input type="text" name="password">' +
  '</p>' +
  '<p>' +
    '<input type="submit" value="Login">' +
  '</p>' +
  '</form>').end();

//  res.sendStatus(200);
});

app.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  });
});

app.post('/signup', function(req, res) {
  var body = req.body;

  db.knex('users').insert({username: body.username}).then(function() {
    res.status(201);
    // TODO: create a session and save session to database for user
    // redirect the user to index.html
    res.redirect('/');
  });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
