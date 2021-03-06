var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();
var session = require('express-session');

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'Oski'
}))


app.get('/',
function(req, res) {
            console.log(!!req.session.user)

  if (req.session.user) {
    res.render('index');

    console.log("GET REQUEST FOR HOMEPAGE WORKS, SESSION WORKS")
  } else {
    console.log("GET REQUEST DOESNT WORK B/C SESSION ISN'T RECOGNIZED")
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
});

app.get('/create',
function(req, res) {
  if (req.session.user) {
    res.render('index');
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
});

app.get('/login',
function(req, res) {
  res.render('login');
});

app.post('/login',
  function(req,res){

    new User({username:req.body.username}).fetch().then(function(user){
      if(!user){
        res.redirect('/login');
      } else{

        user.comparePassword(req.body.password, function(match){
          if(match) {
            console.log("PASSWORD IS A MATCH!!!!!!!")
            req.session.regenerate(function(){
              req.session.user = req.body.user;
              res.redirect('/');
            })
          } else {
            res.redirect('/login');
          }
        })
      }
    })
  })
    // db.knex('users')
    //   .where('username', '=', req.body.username)
    //   .where('password', '=', req.body.password)
    //   .then(function(queryRes){
    //     if (queryRes[0]) {
    //       req.session.regenerate(function(){
    //       req.session.user = queryRes[0].username;
    //       res.redirect(302, '/');
    //         })
    //       } else {
    //         res.redirect('/login');
    //       }
    //      })
    //     }


app.get('/links',
function(req, res) {
  if (req.session.user) {
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
  })
} else {
  req.session.error = 'Access denied!';
  res.redirect('/login');
}
});


app.get('/signup',
function(req, res) {
  res.render('signup');
});



app.post('/signup', function(req, res){
  var thisUsername = req.body.username;
  console.log("req.body: " + req.body)

  new User({username: thisUsername}).fetch().then(function(found){
    if (found) {
       console.log('Account already exists');
       res.redirect('/signup');
    } else {


        var user = new User({username: thisUsername, password:req.body.password})

        user.save().then(function(newUser){
          Users.add(newUser);
          //LOG THEM IN
          req.session.regenerate(function(){
          req.session.user = thisUsername;
          res.redirect(302, '/');
            })
          console.log("req.session.user is falsy or no? " + req.session.user)
          })

        }

    })
  })


//})


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
