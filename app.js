const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('express-flash');
const bcrypt = require('bcryptjs');
const Todo = require('./models/Todo');
const User = require('./models/User');

const app = express();

// Connect to MongoDB without deprecated options
mongoose.connect('mongodb+srv://joshuaosigbeme:kZjm3iuThUI40lEn@cluster0.37qrh8r.mongodb.net/todo-app?retryWrites=true&w=majority&appName=Cluster0');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb+srv://joshuaosigbeme:kZjm3iuThUI40lEn@cluster0.37qrh8r.mongodb.net/todo-app?retryWrites=true&w=majority&appName=Cluster0' })
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Passport.js Configuration
passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({ username });
        if (!user) return done(null, false, { message: 'Incorrect username.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: 'Incorrect password.' });

        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Middleware to protect routes
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Routes
app.get('/', ensureAuthenticated, async (req, res) => {
    const todos = await Todo.find({ user: req.user.id });
    res.render('index', { todos });
});

app.post('/add', ensureAuthenticated, async (req, res) => {
    const { task, dueDate } = req.body;
    const newTodo = new Todo({
        task,
        dueDate,
        user: req.user.id
    });
    await newTodo.save();
    res.redirect('/');
});

app.post('/complete/:id', ensureAuthenticated, async (req, res) => {
    await Todo.findByIdAndUpdate(req.params.id, { completed: true });
    res.redirect('/');
});

app.post('/delete/:id', ensureAuthenticated, async (req, res) => {
    await Todo.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

app.get('/edit/:id', ensureAuthenticated, async (req, res) => {
    const todo = await Todo.findById(req.params.id);
    if (todo.user != req.user.id) return res.redirect('/');
    res.render('edit', { todo });
});

app.post('/edit/:id', ensureAuthenticated, async (req, res) => {
    const { task, dueDate } = req.body;
    await Todo.findByIdAndUpdate(req.params.id, { task, dueDate });
    res.redirect('/');
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

app.get('/register', (req, res) => res.render('register'));
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const newUser = new User({ username, password });
    await newUser.save();
    res.redirect('/login');
});

// Logout Route
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/login');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
