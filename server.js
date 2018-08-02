const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const awsParamStore = require( 'aws-param-store' );


// invoke an instance of express application.
var app = express();

// set our application port
app.set('port', 80);

// initialize body-parser to parse incoming parameters requests to req.body
app.use(bodyParser.urlencoded({ extended: true }));

// initialize cookie-parser to allow us access the cookies stored in the browser. 
app.use(cookieParser());

// initialize express-session to allow us track the logged-in user across sessions.
app.use(session({
    key: 'user_sid',
    secret: 'somerandonstuffs',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000
    }
}));

const region = { region: 'us-east-1' };
const db_endpoint = awsParamStore.getParameterSync('db_endpoint', region);
const db_user = awsParamStore.getParameterSync('db_user', region);
const db_password = awsParamStore.getParameterSync('db_password', region);
const db_name = awsParamStore.getParameterSync('db_name', region);

const knex = require('knex')({
  client: 'mysql',
  version: '5.6',
  connection: {
    host : db_endpoint,
    user : db_user,
    password : db_password,
    database : db_name,
  }
});


// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {

    console.log('cookices', req.cookies, req.session)
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');        
    }
    next();
});


// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
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
        //User.create({
            //username: req.body.username,
            //email: req.body.email,
            //password: req.body.password
        //})
        //.then(user => {
            //req.session.user = user.dataValues;
            //res.redirect('/dashboard');
        //})
        //.catch(error => {
            //res.redirect('/signup');
        //});
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
    if (req.session.user && req.cookies.user_sid) {
        res.sendFile(__dirname + '/public/dashboard.html');
    } else {
        res.redirect('/login');
    }
});


// route for user logout
app.get('/logout', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.clearCookie('user_sid');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});


// route for handling 404 requests(unavailable routes)
app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
});

// start the express server
app.listen(app.get('port'), () => console.log(`App started on port ${app.get('port')}`));
