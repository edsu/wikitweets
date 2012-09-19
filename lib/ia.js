/*
 * ia - library for talking to Internet Archive s3-like object store
 *
 * more information about the IA storage API and where to obtain
 * keys can be found at http://archive.org/help/abouts3.txt
 */

var xml2js = require('xml2js'),
    request = require('request');

/**
 * IA client constructor. You will need keys available from
 * 
 * @param {bucket} the Internet Archive bucket
 * @param {accessKey} the IA access key
 * @param {secretKey} the IA secret key
 */

function IA(opts) {
  if (! (opts && opts.bucket && opts.accessKey && opts.secretKey)) {
    throw new Error("must supply bucket, accessKey and secretKey");
  }
  this.bucket = opts.bucket;
  this.accessKey = opts.accessKey;
  this.secretKey = opts.secretKey;
  return this;
}

/**
 * Create the bucket. You only need to call this if the 
 * bucket has not yet been created at IA. There's no
 * need to call it for pre-existing buckets.
 *
 * @param {callback} a function that is called once the bucket has been created
 */

IA.prototype.create = function (callback) {
  this.request("/", {method: "PUT"}, function(result) {
    if (callback) callback(result);
  });
}

/**
 * Add a object to the bucket.
 *
 * @param {name} the name of the object
 * @param {value} the content of the object
 */

IA.prototype.addObject = function (opts, callback) {
  var name = opts.name;
  var value = opts.value;
  this.request(name, {method: "PUT", body: value}, function(result) {
    if (callback) callback();
  });
}

/**
 * List objects in the bucket
 *
 * @param {callback} a function that is handed a list of JavaScript objects
 * representing each keyfile.
 */

IA.prototype.list = function (callback) {
  this.request("/", {method: "GET", parseXml: true}, function(result) {
    if (callback) callback(result.ListBucketResult.Contents);
  });
}

/**
 * Get an object
 *
 * @param {name} object name, e.g. "/README.txt"
 * @param {callback} function that will be passed the content of the object
 */

IA.prototype.get = function (name, callback) {
  this.request(name, {method: "GET"}, function(result) {
    if (callback) callback(result);
  });
}

/**
 * Returns a low security Authorization string.
 */

IA.prototype.lowAuth = function () {
  return "LOW " + this.accessKey + ":" + this.secretKey;
}

/**
 * Underlying HTTP utility convenience method. You probably don't need to 
 * call this.
 *
 * @param {path}
 * @param {opts}
 * @param {callback}
 */

IA.prototype.request = function (path, opts, callback) {
  opts.url = "http://" + this.bucket + ".s3.us.archive.org" + path;
  if (! opts.headers) opts.headers = {}
  opts.headers.Authorization = this.lowAuth();
  request(opts, function(err, response, content) {
    if (err) console.log(err);
    if (content && opts.parseXml) {
      var parser = new xml2js.Parser();
      parser.parseString(content, function(err, result) {
        callback(result);
      });
    } else {
      callback(content)
    }
  });
}

exports.createClient = function (options) {
  return new IA(options);
}
