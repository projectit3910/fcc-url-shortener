var express = require("express");
var mongo = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectId;
var app = express();

var MONGO_SERVER = "mongodb://ngocdon:urlshortener@ds023912.mlab.com:23912/url";

app.use(express.static(__dirname + "/public"));

app.set("view engine", "ejs");

app.get("/", function (req, res) {
	res.render("index", {host: (req.connection.encrypted ? "https://" : "http://") + req.headers.host});
})

app.get("/new/*", function (req, res) {
	var url = req.url.substring('/new/'.length);
	if (!(/^https?:\/\/([\w0-9\-_]+\.)+([\w-_0-9\?\&=]+)(:[0-9]+)?$/).test(url)){
		res.json({
			error: "Invalid url format"
		});
		return;
	}
	mongo.connect(MONGO_SERVER, function (err, db) {
		var urls = db.collection("urls");
		urls.find({
			full: url
		},{
			_id: 0,
			short: 1,
			full: 1
		}).toArray(function (err, array) {
			if (array.length > 0){
				res.json(array.map(function (val) {
					val.short = (req.connection.encrypted ? "https://" : "http://") + req.headers.host + '/' + val.short;
					return val;	
				})[0]);
				res.end();
				db.close();
				return;
			}
			urls.aggregate([
			{
				$match: {

				}
			},
			{
				$group: {
					_id: "max",
					max: {
						$max: "$short"
					}
				}
			}
			]).toArray(function (err, array) {
				if (err) {
					console.log(err);
					res.end("error");
					db.close();
					return;
				}
				var max = 0;
				if (array.length > 0)
					var max = parseInt(array[0].max);
				if (!max){
					max = 0;
				}
				var docs = {
					short: max + 1,
					full: url
				};
				urls.insert(docs, function (err) {
					if (err){
						console.log(err);
						res.end("error");
						db.close();
						return;
					}
					docs.short = (req.connection.encrypted ? "https://" : "http://") + req.headers.host + '/' + docs.short;
					delete docs._id;
					res.json(docs);
					res.end();
					db.close();
				})
			})
		})
	})
});

app.get("/:id", function (req, res) {
	var id = req.params.id;
	if (/^[0-9]+$/.test(id)){
		mongo.connect(MONGO_SERVER, function (err, db) {
			if (err){
				console.log(err);
				return;
			}
			var urls = db.collection("urls");
			id = parseInt(id);
			urls.find({
				short: id
			}).toArray(function (err, array) {
				if (err){
					console.log(err);
					db.close();
					return;
				}
				if (array.length < 1){
					res.json({
						error: "This url is not in the database"
					});
					db.close();
				}
				db.close();
				res.redirect(array[0].full);
			})
		})
	}
	else{
		res.end("404");
	}
})

app.listen(process.env.PORT || 3000);

