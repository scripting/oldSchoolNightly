const myProductName = "Old School Nightly", myVersion = "0.4.7";

const utils = require ("daveutils");
const request = require ("request");
const fs = require ("fs");

var config = {
	username: "scripting",
	repo: "Scripting-News",
	basefolder: "data/",
	basepath: "blog/",
	type: "text/html",
	urlRssFile: "http://scripting.com/rss.xml",
	pathRssFile: "rss.xml",
	committer: {
		name: "Dave Winer",
		email: "dave.winer@gmail.com"
		},
	message: "Nightly update",
	userAgent: "Dave's OldSchool GitHub Uploader"
	};
var stats = {
	whenLastUpdate: new Date (0)
	};
const fnameStats = "stats.json", fnameConfig = "config.json";

function getGitHubFile (repoPath, callback) {
	var url = "https://" + config.username + ":" + config.password + "@api.github.com/repos/" + config.username + "/" + config.repo + "/contents/" + repoPath;
	var theRequest = {
		method: "GET",
		url: url,
		headers: {
			"User-Agent": config.userAgent
			}
		};
	request (theRequest, function (err, response, body) { 
		var jstruct = undefined;
		if (err) {
			console.log ("getGitHubFile: err.message == " + err.message);
			}
		else {
			try {
				jstruct = JSON.parse (body);
				}
			catch (err) {
				console.log ("getGitHubFile: err.message == " + err.message);
				}
			}
		if (callback !== undefined) {
			callback (jstruct);
			}
		});
	}
function getDirectory (folder, callback) {
	if (!utils.endsWith (folder, "/")) {
		folder += "/";
		}
	utils.sureFilePath (folder, function () {
		fs.readdir (folder, function (err, list) {
			if (err) {
				console.log ("visitDirectory: err.message == " + err.message);
				}
			else {
				if (list !== undefined) { 
					callback (list);
					}
				}
			});
		});
	}


function uploadOneObject (data, repoPath, callback) {
	var bodyStruct = { 
		message: config.message,
		committer: {
			name: config.committer.name,
			email: config.committer.email
			},
		content: new Buffer (data).toString ('base64')
		};
	getGitHubFile (repoPath, function (jstruct) {
		if (jstruct !== undefined) {
			bodyStruct.sha = jstruct.sha;
			}
		var username = config.username;
		var url = "https://" + username + ":" + config.password + "@api.github.com/repos/" + username + "/" + config.repo + "/contents/" + repoPath;
		var theRequest = {
			method: "PUT",
			url: url,
			body: JSON.stringify (bodyStruct),
			headers: {
				"User-Agent": config.userAgent,
				"Content-Type": config.type
				}
			};
		request (theRequest, function (err, response, body) { 
			if (err) {
				console.log ("uploadOneFile: f == " + f + ", err.message == " + err.message);
				}
			else {
				console.log ("uploadOneObject: response.statusCode == " + response.statusCode);
				}
			if (callback !== undefined) {
				callback ();
				}
			});
		});
	}
function uploadOneFile (f, repoPath, callback) {
	fs.readFile (f, function (err, data) {
		if (err) {
			console.log ("uploadOneFile: f == " + f + ", err.message == " + err.message);
			if (callback !== undefined) {
				callback ();
				}
			}
		else {
			uploadOneObject (data, repoPath, callback);
			}
		});
	}
function uploadHttpFile (url, repoPath, callback) {
	var theRequest = {
		method: "GET",
		url: url,
		headers: {
			"User-Agent": config.userAgent
			}
		};
	request (theRequest, function (err, response, body) { 
		if (err) {
			console.log ("uploadHttpFile: err.message == " + err.message);
			if (callback !== undefined) {
				callback ();
				}
			}
		else {
			uploadOneObject (body, repoPath, callback);
			}
		});
	}
function uploadTodaysFile (today, foldername, ext, callback) {
	var f = config.basefolder + foldername + "/dave/" + utils.getDatePath (today, false) + ext;
	var repoPath = config.basepath + foldername + "/" + utils.getDatePath (today, false) + ext;
	uploadOneFile (f, repoPath, callback);
	}
function doOneFolder (now, foldername, callback) {
	var folder = config.basefolder + foldername + "/dave/" + utils.getDatePath (now, true);
	getDirectory (folder, function (list) {
		function donextfile (ix) {
			if (ix < list.length) {
				let fname = list [ix];
				let repoPath = config.basepath + foldername + "/" + utils.getDatePath (now, true) + fname;
				uploadOneFile (folder + fname, repoPath, function () {
					donextfile (ix + 1);
					});
				}
			else {
				if (callback !== undefined) {
					callback ();
					}
				}
			}
		donextfile (0);
		});
	}
function doUploads () {
	uploadHttpFile (config.urlRssFile, config.basepath + config.pathRssFile, function () {
		var yesterday = utils.dateYesterday (new Date ());
		uploadTodaysFile (yesterday, "pages", ".html", function () {
			uploadTodaysFile (yesterday, "days", ".json", function () {
				doOneFolder (yesterday, "items");
				});
			});
		});
	}
function checkForUpload () {
	var now = new Date ();
	if (!utils.sameDay (now, stats.whenLastUpdate)) {
		stats.whenLastUpdate = now;
		fs.writeFile (fnameStats, utils.jsonStringify (stats), function (err) {
			});
		console.log ("");
		doUploads ();
		}
	}
function everyMinute () {
	var now = new Date ();
	console.log ("\n" + myProductName + " v" + myVersion + ": " + now.toLocaleTimeString ());
	checkForUpload ();
	}
function runTestCode () {
	doUploads ();
	}

console.log ("\n" + myProductName + " v" + myVersion + ".");
fs.readFile (fnameStats, function (err, data) {
	if (!err) {
		let jstruct = JSON.parse (data);
		for (x in jstruct) {
			stats [x] = jstruct [x];
			}
		}
	fs.readFile (fnameConfig, function (err, data) {
		var jstruct = JSON.parse (data);
		for (x in jstruct) {
			config [x] = jstruct [x];
			}
		checkForUpload (); //check immediately at startup
		runTestCode (); //comment out to deploy for real -- 7/12/18 by DW
		utils.runAtTopOfMinute (function () {
			setInterval (everyMinute, 60000); 
			everyMinute ();
			});
		});
	});
