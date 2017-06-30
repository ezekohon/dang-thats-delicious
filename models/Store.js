const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
	name: {
		type: String,
		trim: true,
		required: 'Please enter a store name'

	},
	slug: String,
	description: {
		type: String,
		trim: true
	},
	tags: [String],
	created: {
		type: Date,
		default: Date.now
	},
	location: {
		type: {
			type: String,
			default: 'Point'
		},
		coordinates: [{
			type: Number,
			required: 'You must supply coordinates'
		}],
		address: {
			type: String,
			required: 'You must suppy an address'
		}
	},
	photo: String,
	author: {
		type: mongoose.Schema.ObjectId,
		ref: 'User',
		required: 'You must supply an author'
	}
}, {
	toJSON: { virtuals: true},
	toObject: { virtual: true }
});

//define indexes for searching
storeSchema.index({
	name: 'text',
	description: 'text'
});

storeSchema.index({
	location: '2dsphere'
});


storeSchema.pre('save', async function(next){
	if (!this.isModified('name')){
		next();
		return;
	}
	this.slug = slug(this.name);
	//find other stores equal name
	const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
	const storesWithSlug = await this.constructor.find({ slug: slugRegEx}); //constructor is Store
	if(storesWithSlug.length) {
		this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
	}
	next();
});

storeSchema.statics.getTagsList = function(){ //adding a function to the schema. Using 'function' cos of have to use this inside
	return this.aggregate([
		
		{ $unwind: '$tags'}, //duplicates the stores so one in the DB has one tag 
		{ $group: {_id: '$tags', count: { $sum: 1 } }},//grouping based in tags and creating a count	
		{ $sort: { count: -1} }
		]);

};

storeSchema.statics.getTopStores = function(){
	return this.aggregate([
		//lookup stores and populate their review (cant use the virtual cos is mongoose, aggregate is mongodb) 
		//the from 'reviews' is cos mongodb takes the model and lowercase and puts an s in the end
		{ $lookup: {
			from: 'reviews', 
			localField: '_id', 
			foreignField: 'store', 
			as: 'reviews'
		}},
		//filter for only items that have 2 or more review
		//review.1 accesses the second item in reviews
		{ $match: { 'reviews.1': { $exists: true} } },
		//add the average reveiws field
		//project adds a field
		{ $project: { //addfield is new in 3.4, better
			photo: '$$ROOT.photo',
			name: '$$ROOT.name',
			slug: '$$ROOT.slug',
			reviews: '$$ROOT.reviews',
			averageRating: { $avg: '$reviews.rating' } //$ means its from the data piped in
		}},
		//sort it by average, hig first
		{ $sort: { averageRating: -1 }},
		//limit to 10
		{ $limit: 10 }
		]);
};

//find reviews where the stores _id prop === review store prop
//like a join in SQL
storeSchema.virtual('reviews', {  //virtual populate mongoose
	ref: 'Review', //model to link
	localField: '_id', //which field in the store
	foreignField: 'store', //which field in the review

});

function autopopulate(next) {
	this.populate('reviews');
	next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);