var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');
var passport = require('passport');
var GithubStrategy = require('passport-github').Strategy;

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
app.use(passport.initialize());
app.use(passport.session());

// redirects user to login page if session is not valid
var checkUser = function (req, res, next) {
  // if (req.session.user) {
  //   next();
  // } else {
  //   req.session.error = 'Access denied!';
  //   res.redirect('/login');
  // }
};

passport.use(new GithubStrategy({
  clientID: '3aa86644323f6236cb15',
  clientSecret: '976b72c0d502c25442061b4f16413cdcbcf011ac',
  callbackURL: 'http://localhost:4568/auth/callback'
}, function(accessToken, refreshToken, profile, done) {
  done(null, {
    accessToken: accessToken,
    profile: profile
  });
}));

passport.serializeUser(function(user, done) {
  console.log(user);
  done(null, user);
});

passport.deserializeUser(function(user, done) {
   
  done(null, user);
});

app.get('/auth', passport.authenticate('github'));
app.get('/auth/error', function(req, res) {
  res.sendStatus(404);
});
app.get('/auth/callback',
  passport.authenticate('github', {failureRedirect: '/auth/error'}),
  function(req, res) {
    res.redirect('/');
  });

app.get('/', function(req, res) {
  console.log('-----------------------------------', req.session);
  res.render('index'); 
});

app.get('/create', checkUser, function(req, res) {
  res.render('index');
});

app.get('/links', checkUser, function(req, res) {
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


  // check that username and password authenticate to the database 
  db.knex('users').where({username: username}).then(function(result) {
    if (result.length > 0) {
      bcrypt.compare(password, result[0].password, function(err, match) {
        if (match) {
          util.createSession(req, res, username);
        } else {
          res.status(200).redirect('/login');    
        }
      });
    } else { // then create a session
      res.status(200).redirect('/login');
    }
  });
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  });
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  bcrypt.hash(password, null, null, function(err, hash) {
    db.knex('users').insert({username: username, password: hash}).then(function() {
      util.createSession(req, res, username);
    });
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
