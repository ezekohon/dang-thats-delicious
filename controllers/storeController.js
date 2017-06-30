const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const multer = require('multer'); //photo upload 
const jimp = require('jimp'); //resize image
const uuid = require('uuid'); //unique id
const User = mongoose.model('User');

const multerOptions = {
	storage: multer.memoryStorage(),
	fileFilter: function(req, file, next){
		const isPhoto = file.mimetype.startsWith('image/');
		if(isPhoto) {
			next(null, true); //1rst param is error
		} else{
			next({ message: 'that filetype isn\'t allowed'}, false);
		}
	}
};


exports.homePage = (req, res) => {
	res.render('index');
	
};

exports.addStore = (req, res) => {
	res.render('editStore', {title: 'Add Store'});
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
	if (!req.file){
		next(); //skip to next middleware if no file to upload
		return;
	}
	//console.log(req.file);
	const extension = req.file.mimetype.split('/')[1];
	req.body.photo = `${uuid.v4()}.${extension}`;
	//resizing
	const photo = await jimp.read(req.file.buffer);
	await photo.resize(800, jimp.AUTO);
	await photo.write(`./public/uploads/${req.body.photo}`);
	//once writte the photo, keep going
	next();
};


exports.createStore = async (req, res) => {
	req.body.author = req.user._id;
	const store = await (new Store(req.body)).save();
	//async await
	req.flash('success', `Successfully created ${store.name}. Care to
		leave a review?`);	
	res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
	const page = req.params.page || 1;
	const limit = 4;
	const skip = (page*limit) - limit;
	// 1. query db for list of all stores
	const storesPromise = Store
		.find()
		.skip(skip)
		.limit(limit)
		.sort( { created: 'desc' });

	const countPromise = Store.count();
	
	//awaiting 2 promises
	const [stores, count] = await Promise.all([storesPromise, countPromise]); 	

	const pages = Math.ceil(count / limit);
	if(!stores.length && skip){
		req.flash('info', `You asked for page ${page}. But that does't exists. So I put you on page ${pages}`);
		res.redirect(`/stores/page/${pages}`);
		return;
	}
	res.render('stores', { title: 'Stores', stores, page, pages, count}); //stores.pug
};

const confirmOwner = (store, user) => {
	if (!store.author.equals(user._id)){
		throw Error('You must own a store in order to edit it.');
	}
};

exports.editStore = async (req, res) => {
	//find the store given the id
	const store = await Store.findOne({ _id: req.params.id});
	//confirm they are owner
	confirmOwner(store, req.user);
	//render the edit form
	res.render('editStore', { title: `Edit ${store.name}`, store: store});
};

exports.updateStore = async (req, res) => { //mongo siempre responde promise, por eso el await siempre
	//set the location data to be a point
	req.body.location.type = 'Point';
	///find and update store
	const store = await Store.findOneAndUpdate({ _id: req.params.id}, req.body, {
		new : true, //return new store instead the old one
		runValidators: true
	}).exec(); //metodo de mongo
	req.flash('success', `Successfully updated ${store.name} <a href="/stores/${store.slug}">View store -></a>`);
	res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
	//res.json(req.params);
	const store = await Store.findOne({ slug: req.params.slug}).
		populate('author reviews'); //fills the field with mongo fields
	if(!store) return next();
	res.render('store', {store, title:store.name});
};

exports.getStoresByTag = async (req, res) => {
	const tag = req.params.tag;
	const tagQuery = tag || { $exists: true};
	const tagsPromise = Store.getTagsList();
	const storesPromise = Store.find({ tags: tagQuery});
	const [tags, stores] /*ES6 destructure*/= await Promise.all([tagsPromise, storesPromise]); //awaiting 2 promises on 1

	
	res.render('tag', {tags: tags, title: 'Tags', tag, stores });
};


exports.searchStores = async (req, res) => {
	const stores = await Store
	//first find stores that match
	.find({
		$text: {
			$search: req.query.q
		}
	}, {
		score: { $meta: 'textScore'} //add a field
	})
	//then sort them
	.sort({
		score: { $meta: 'textScore'}
	})
	.limit(5);
	res.json(stores);

};

exports.mapStores = async (req, res) => {
	const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
	const q = {
		location: {
			$near:{
				$geometry: {
					type: 'Point',
					coordinates
				},
				$maxDistance: 10000 // 10km
			}
		}
	};

	const stores = await Store.find(q).select('slug name description location photo').limit(10); // select wich fields do i want
	res.json(stores);
};

exports.mapPage = (req, res) => {
	res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
	const hearts = req.user.hearts.map(obj => obj.toString());
	const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet'; //2 mongo methods
	const user = await User
	.findByIdAndUpdate(req.user._id, 
		{ [operator]: { hearts: req.params.id } },
		{ new: true }
		);
	res.json(user);
};

exports.getHearts = async (req, res) => {
	const stores = await Store.find({
		_id: { $in: req.user.hearts }
	});
	res.render('stores', { title: 'Hearted Stores', stores });
};

exports.getTopStores = async (req, res) => {
	const stores = await Store.getTopStores(); //query in the model
	res.render('topStores', { stores, title: 'Top Stores!'});
};