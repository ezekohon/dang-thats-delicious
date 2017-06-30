const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise; //supresses some error
const md5 = require('md5');
const validator = require('validator');
const mongodbErrorHandler = require('mongoose-mongodb-errors');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
	email: {
		type: String,
		unique: true,
		lowercase: true,
		trim: true,
		validate: [validator.isEmail, 'Invalid email address'],
		require: 'Please supply an email address'
	},
	name: {
		type: String,
		require: 'Please supply a name',
		trim: true
	},
	resetPasswordToken: String,
	resetPasswordExpires: Date,
	hearts: [
		{ type: mongoose.Schema.ObjectId, ref: 'Store' }
	]

});

userSchema.virtual('gravatar').get(function(){ //virtual on mongo
	const hash = md5(this.email);
	return `https://gravatar.com/avatar/${hash}?s=200`;
});

userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });
userSchema.plugin(mongodbErrorHandler); //a package for nicer errors


module.exports = mongoose.model('User', userSchema);