const mongoose = require('mongoose');
const User = mongoose.model('User'); //importing the model
const promisify = require('es6-promisify');

exports.loginForm = (req, res) => {
	res.render('login', { title: 'Login'});

};

exports.registerForm = (req, res) => {
	res.render('register', { title: 'Register'});
};

exports.validateRegister = (req, res, next) => {
	req.sanitizeBody('name'); //expressValidator required in app.js
	req.checkBody('name', 'You must supply name').notEmpty();
	req.checkBody('email', 'That email is not valid').isEmail();
	req.sanitizeBody('email').normalizeEmail({
		remove_dots: false,
		remove_extension: false,
		gmail_remove_subaddress: false
	});
	req.checkBody('password', 'Password cannot be blank!').notEmpty();
	req.checkBody('password-confirm', 'Confirm Password cannot be blank!').notEmpty();
	req.checkBody('password-confirm', 'Your passwords do not match').equals(req.body.password);

	const errors = req.validationErrors(); //checks all of the above
	if (errors) {
		req.flash('error', errors.map(err => err.msg));
		res.render('register', { title: 'Register', body: req.body, flashes: req.flash() });
		return;
	}
	next(); //there were no errors
};

exports.register = async(req, res, next) => {
	const user = new User({ email: req.body.email, name: req.body.name});
	const register = promisify(User.register, User); //passportLocalMongoose plugin in User.js, promisify cos the library doesnt use promises
	await register(user, req.body.password);
	next(); //pass to authcontroller.login
};

exports.account = (req, res) => {
	res.render('account', { title: 'Edit your account' });
};

exports.updateAccount = async (req, res) => {
	const updates = {
		name: req.body.name,
		email: req.body.email
	};
	const user = await User.findOneAndUpdate(
		{ _id: req.user._id },
		{ $set: updates },
		{ new: true, runValidators: true, context: 'query' }
		);
	req.flash('success', 'Updated!');
	res.redirect('back');
};
//