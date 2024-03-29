const myProductName = "Old School Nightly", myVersion = "0.5.16";  


const fs = require ("fs");
const utils = require ("daveutils");
const request = require ("request"); 
const davegithub = require ("davegithub"); 
const opmlToJs = require ("opmltojs");

var config = {
	username: "scripting",
	repo: "Scripting-News",
	basefolder: "data/",
	basepath: "blog/",
	type: "text/html",
	miscFiles: [ //8/21/18 by DW
		{
			url: "http://scripting.com/rss.xml",
			path: "blog/rss.xml",
			type: "text/xml"
			},
		{
			url: "http://drummer.scripting.com/davewiner/glossary.opml",
			path: "blog/misc/glossary.opml",
			type: "text/xml"
			},
		{
			url: "http://radio3.io/users/davewiner/rss.xml",
			path: "blog/misc/linkblog.xml",
			type: "text/xml"
			},
		{
			url: "http://podcatch.com/users/davewiner/podcasts.opml",
			path: "podcatch/subscriptions.opml",
			type: "text/xml"
			},
		{
			url: "http://drummer.scripting.com/davewiner/this.how/scriptingNews/nightlyArchive.opml",
			path: "blog/readme.md",
			type: "text/md"
			}
		],
	committer: {
		name: "Dave Winer",
		email: "dave.winer@gmail.com"
		},
	message: "Nightly update",
	userAgent: "Dave's OldSchool GitHub Uploader",
	titleHeaderMarkdown: "## ",
	topLevelHeaderMarkdown: "#### "
	};
var stats = {
	whenLastUpdate: new Date (0),
	ctUploads: 0,
	whenLastUpload: new Date (0),
	ctUploadErrors: 0,
	ctConsecutiveUploadErrors: 0,
	whenLastUploadError: new Date (0)
	};

const fnameStats = "stats.json", fnameConfig = "config.json";
var flStatsChanged = false;

function opmlToMarkdown (opmltext, options, callback) { //9/4/18 by DW
	var mdtext = "", indentlevel = 0;
	function add (s) {
		mdtext += utils.filledString ("\t", indentlevel) + s + "\n\n";
		}
	function addSubs (head) {
		for (var i = 0; i < head.subs.length; i++) {
			var sub = head.subs [i];
			add (sub.text);
			}
		}
	opmlToJs.parse (opmltext, function (theOutline) {
		if (theOutline === undefined) {
			console.log ("There was an error parsing the OPML text.");
			}
		else {
			add (config.titleHeaderMarkdown + theOutline.opml.head.title);
			for (var i = 0; i < theOutline.opml.body.subs.length; i++) {
				var topHead = theOutline.opml.body.subs [i];
				add (config.topLevelHeaderMarkdown + topHead.text);
				addSubs (topHead);
				}
			if (callback !== undefined) {
				callback (mdtext);
				}
			}
		});
	}
function statsChanged () {
	flStatsChanged = true;
	}
function getDirectory (folder, callback) {
	if (!utils.endsWith (folder, "/")) {
		folder += "/";
		}
	utils.sureFilePath (folder, function () {
		fs.readdir (folder, function (err, list) {
			if (err) {
				console.log ("getDirectory: err.message == " + err.message);
				}
			else {
				if (list !== undefined) { 
					callback (list);
					}
				}
			});
		});
	}
function uploadToGithub (path, data, type, callback) {
	const options = {
		username: config.username,
		repo: config.repo,
		password: config.password,
		repoPath: path,
		data: data,
		type: (type === undefined) ? "text/plain" : type,
		committer: config.committer,
		message: config.message,
		userAgent: config.userAgent
		};
	davegithub.uploadFile (options, function (err, response, body) {
		console.log ("uploadToGithub: path == " + path + ", status == " + response.statusCode);
		//stats
			var now = new Date ();
			stats.ctUploads++;
			stats.whenLastUpload = now;
			if (err) {
				stats.ctUploadErrors++;
				stats.ctConsecutiveUploadErrors++;
				stats.whenLastUploadError = now;
				}
			else {
				stats.ctConsecutiveUploadErrors = 0;
				}
			statsChanged ();
		if (callback !== undefined) {
			callback ();
			}
		});
	}
function uploadFromUrl (path, url, type, callback) {
	var theRequest = {
		method: "GET",
		url: url,
		headers: {
			"User-Agent": config.userAgent
			}
		};
	request (theRequest, function (err, response, body) { 
		if (err) {
			console.log ("uploadFromUrl: err.message == " + err.message);
			if (callback !== undefined) {
				callback ();
				}
			}
		else {
			var filetext = body.toString ();
			if (type == "text/md") { //9/4/18 by DW
				opmlToMarkdown (filetext, config, function (mdtext) {
					uploadToGithub (path, mdtext, type, callback);
					});
				}
			else {
				uploadToGithub (path, filetext, type, callback);
				}
			}
		});
	}
function uploadFromFile (f, repoPath, callback) {
	fs.readFile (f, function (err, data) {
		if (err) {
			console.log ("uploadFromFile: f == " + f + ", err.message == " + err.message);
			if (callback !== undefined) {
				callback ();
				}
			}
		else {
			uploadToGithub (repoPath, data.toString (), undefined, callback);
			}
		});
	}
function uploadTodaysFile (today, foldername, ext, callback) {
	var f = config.basefolder + foldername + "/dave/" + utils.getDatePath (today, false) + ext;
	var repoPath = config.basepath + foldername + "/" + utils.getDatePath (today, false) + ext;
	uploadFromFile (f, repoPath, callback);
	}
function uploadFolderToGithub (today, foldername, callback) {
	var folder = config.basefolder + foldername + "/dave/" + utils.getDatePath (today, true);
	getDirectory (folder, function (list) {
		function donextfile (ix) {
			if (ix < list.length) {
				let fname = list [ix];
				let repoPath = config.basepath + foldername + "/" + utils.getDatePath (today, true) + fname;
				uploadFromFile (folder + fname, repoPath, function () {
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
function uploadMiscFiles (callback) {
	function uploadOne (ix) {
		if (ix < config.miscFiles.length) {
			let item = config.miscFiles [ix];
			uploadFromUrl (item.path, item.url, item.type, function () {
				uploadOne (ix + 1);
				});
			}
		else {
			if (callback !== undefined) {
				callback ();
				}
			}
		}
	uploadOne (0);
	}
function setWhenLastUpdate () {
	stats.whenLastUpdate = new Date ();
	statsChanged ();
	}
function doUploads (callback) {
	var yesterday = utils.dateYesterday (new Date ());
	setWhenLastUpdate ();
	uploadTodaysFile (yesterday, "pages", ".html", function () {
		uploadTodaysFile (yesterday, "days", ".json", function () {
			uploadFolderToGithub (yesterday, "items", function () {
				uploadMiscFiles (function () {
					if (callback !== undefined) {
						callback ();
						}
					});
				});
			});
		});
	}
function checkForUpload () {
	var now = new Date ();
	if (!utils.sameDay (now, stats.whenLastUpdate)) {
		console.log ("");
		doUploads ();
		}
	}
function everyMinute () {
	var now = new Date ();
	if (now.getMinutes () == 0) {
		console.log ("\n" + myProductName + " v" + myVersion + ": " + now.toLocaleTimeString ());
		}
	checkForUpload ();
	if (flStatsChanged) {
		flStatsChanged = false;
		fs.writeFile (fnameStats, utils.jsonStringify (stats), function (err) {
			});
		}
	}

console.log ("\n" + myProductName + " v" + myVersion + ".\n");
fs.readFile (fnameStats, function (err, data) {
	if (!err) {
		const jstruct = JSON.parse (data);
		for (var x in jstruct) {
			stats [x] = jstruct [x];
			}
		}
	fs.readFile (fnameConfig, function (err, data) {
		if (err) {
			console.log (myProductName + ": err.message == " + err.message);
			}
		else {
			const jstruct = JSON.parse (data);
			for (var x in jstruct) {
				config [x] = jstruct [x];
				}
			doUploads (function () { //do an upload at startup
				utils.runEveryMinute (everyMinute);
				});
			}
		});
	});


