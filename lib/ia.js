var xml2js = require('xml2js'),
    request = require('request');

function IA(opts) {
  if (! (opts && opts.bucket && opts.accessKey && opts.secretKey)) {
    throw new Error("must supply bucket, accessKey and secretKey");
  }
  this.bucket = opts.bucket;
  this.accessKey = opts.accessKey;
  this.secretKey = opts.secretKey;
  return this;
}

IA.prototype.create = function (callback) {
  this.request("/", {method: "PUT"}, function(result) {
    if (callback) callback(result);
  });
}

IA.prototype.addObject = function (opts, callback) {
  var name = opts.name;
  var value = opts.value;
  this.request(name, {method: "PUT", body: value}, function(result) {
    if (callback) callback();
  });
}

IA.prototype.list = function (callback) {
  this.request("/", {method: "GET"}, function(result) {
    if (callback) callback(result.ListBucketResult.Contents);
  });
}

IA.prototype.lowAuth = function () {
  return "LOW " + this.accessKey + ":" + this.secretKey;
}

IA.prototype.request = function (path, opts, callback) {
  opts.url = "http://" + this.bucket + ".s3.us.archive.org" + path;
  if (! opts.headers) opts.headers = {}
  opts.headers.Authorization = this.lowAuth();
  request(opts, function(err, response, xml) {
    if (err) console.log(err);
    if (xml) {
      var parser = new xml2js.Parser();
      parser.parseString(xml, function(err, result) {
        callback(result);
      });
    } else {
      callback()
    }
  });
}

exports.createClient = function (options) {
  return new IA(options);
}
