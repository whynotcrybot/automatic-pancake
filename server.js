const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session')
const awsParamStore = require( 'aws-param-store' );

// invoke an instance of express application.
var app = express();

// set our application port
app.set('port', 80);

// initialize body-parser to parse incoming parameters requests to req.body
app.use(bodyParser.urlencoded({ extended: true }));

// initialize cookie-parser to allow us access the cookies stored in the browser. 
app.use(cookieParser());

app.use(cookieSession({
  name: 'session',
  secret: 'somerandonstuffs',

  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}))

const region = { region: 'us-east-1' };

let iserror = true
let db_endpoint

while (iserror) {
  try {
    console.log('trying')
    db_endpoint = awsParamStore.getParameterSync('db_endpoint', region);
    iserror = false
  } catch (e) {
    iserror = true
    continue
  }
}

const db_user = awsParamStore.getParameterSync('db_user', region);
const db_password = awsParamStore.getParameterSync('db_password', region);
const db_name = awsParamStore.getParameterSync('db_name', region);

const knex = require('knex')({
  client: 'mysql',
  version: '5.6',
  connection: {
    host : db_endpoint.Value,
    user : db_user.Value,
    password : db_password.Value,
    database : db_name.Value,
  }
});



// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        next();
    }    
};

// route for Home-Page
app.get('/', sessionChecker, (req, res) => {
    res.redirect('/login');
});

// route for user signup
app.route('/signup')
    .get(sessionChecker, (req, res) => {
        res.sendFile(__dirname + '/public/signup.html');
    })
    .post((req, res) => {
      knex.insert({
        email: req.body.email, 
        password: req.body.password, 
      }).into('users')
        .then(kek => {
          res.redirect('/login')
        })
    });


// route for user Login
app.route('/login')
    .get(sessionChecker, (req, res) => {
        res.sendFile(__dirname + '/public/login.html');
    })
    .post((req, res) => {
        const email = req.body.email;
        const password = req.body.password;

        knex.select('*').from('users').where('email', '=', email)
          .then(function (user) {
            console.log('user', user)
              if (!user.length) {
                  res.redirect('/login');
              } else if (user[0].password !== password) {
                  res.redirect('/login');
              } else {
                  req.session.user = user[0];
                  res.redirect('/dashboard');
              }
          }).catch(e => console.log(e));
    });


// route for user's dashboard
app.get('/dashboard', (req, res) => {
  console.log('session', req.session)
    if (req.session.user) {
        res.sendFile(__dirname + '/public/dashboard.html');
    } else {
        res.redirect('/login');
    }
});


// route for user logout
app.get('/logout', (req, res) => {
    if (req.session.user) {
        res.clearCookie('session');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});


// route for handling 404 requests(unavailable routes)
app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
});

const interval = setInterval(() => {
  console.log('checking table')
  knex.schema.hasTable('users').then((exists) => {
    if (exists) {
      // start the express server
      app.listen(app.get('port'), () => console.log(`App started on port ${app.get('port')}`));
      clearInterval(interval)
    }
  });
}, 1000)
