var util           = require('./lib/utility');
var express        = require('express');
var partials       = require('express-partials');
var session        = require('express-session');
var bodyParser     = require('body-parser');
var cookieParser   = require('cookie-parser');
var passport       = require('passport');
var GitHubStrategy       = require('passport-github').Strategy;

var db    = require('./app/config');
var Users = require('./app/collections/users');
var User  = require('./app/models/user');
var Links = require('./app/collections/links');
var Link  = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser());
// app.use(cookieParser());
app.use(express.static(__dirname + '/public'));
app.use(passport.initialize());
app.use(passport.session());
app.use(session({ secret:'shhhh, very secret' }));    // use the secret option here in session and pass in the newly created username and password


  passport.use(new GitHubStrategy({
      clientID: 'fb806c013d16fdd7bc15',
      clientSecret: '55bc5bab1de3ed08ff6d43dab66448cf2180325c',
      callbackURL: "http://127.0.0.1:4568/auth/github/callback"

    }, function (accessToken, refreshToken, profile, done) {
        new User({ githubId: profile.id }).fetch().then(function (user) {
          console.log(user, 'THE USER');

          if (!user) {
            // create new user with githubId
            var newUser = new User({
              githubId: profile.id,
              githubToken: accessToken
            });
            newUser.save().then(function (newUser) {
              Users.add(newUser);
              return done(null, newUser);
            });
          } else {
            return done(null, user);
          }
          
      });
    }));

  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
    passport.deserializeUser(function(id, done) {
      new User({ id: id }).fetch().then(function(err, user) {
        done(err, user);
      });
    });


  passport.deserializeUser(function(req, res) {
    console.log(req.body.id);
    new User({ id: req.body.id }).fetch().then(function(err, user) {
      done(err, user);
    });
  });

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

/*function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}*/

// route middleware to make sure a user is logged in
// function isLoggedIn(req, res, next) {
//   // if user is authenticated in the session, carry on 
//   if (req.isAuthenticated())
//     return next();

//   // if they aren't redirect them to the home page
//   res.redirect('/');
// }



app.get('/', isLoggedIn, // need to handle restricted access now from github's backend
function(req, res) {
  res.render('index');
});

app.get('/create', isLoggedIn,
function(req, res) {
  res.render('index');
});

app.get('/links', isLoggedIn,
function(req, res) {
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

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {

          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/auth/github', passport.authenticate('github'), function (req, res) {
  res.render('/');
});

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/signup', successRedirect: '/' }));

app.get('/login',
function(req, res) {
  res.render('login');
  // render
});

app.get('/signup',
function(req, res) {
  res.render('signup');
  // render
});

/*app.post('/signup',
function (req, res) {

  var user = new User({
    username: req.body.username,
    password: req.body.password
  });

  user.save().then(function (newUser) {
    
    Users.add(newUser);
    // create a session
    req.session.user = true;
    // redirect to main page
      // -> main page expects a .session.user property
    res.redirect('/');
    
  });
});*/

/*app.post('/login', 
  function(req, res) {
    new User({ username: req.body.username }).fetch().then(function(user) {
      if (!user) {
        res.redirect('/login');
      } else {
        req.session.user = true;
        res.redirect('/');
      }
    });
  });*/

app.get('/logout',
function(req, res) {
  req.session.user = false;
  res.redirect('/login');
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
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
