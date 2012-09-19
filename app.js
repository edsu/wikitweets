var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    ia = require('./lib/ia'),
    jsdom = require('jsdom'),
    _  = require('underscore'),
    express = require('express'),
    request = require('request'),
    twitter = require('ntwitter'),
    socketio = require('socket.io'),
    unshorten = require('unshorten'),
    dateformat = require('dateformat'),
    querystring = require('querystring');

var config = getConfig();
var latest = [];
var dumpSize = 10;
var archiving = false;

function main() {
  var sockets = [];

  var app = express();
  var server = http.createServer(app);
  var io = socketio.listen(server);

  app.configure(function() {
    app.use(express.static(__dirname + '/public'));
  });

  // heroku specific configuration
  io.configure('production', function () {
    io.set("transports", ["xhr-polling"]); 
    io.set("polling duration", 10); 
  });

  io.sockets.on('connection', function(socket) {
    _.each(latest, function(t) {socket.emit('tweet', t);});
    sockets.push(socket);
    socket.on('disconnect', function() {
      sockets = _.without(sockets, socket);
    });
  });

  var tweets = new twitter(getConfig());
  tweets.stream('statuses/filter', {track: 'wikipedia'}, function(stream) {
    stream.on('data', function(t) {
      console.log(t);
      tweet(t, sockets);
    });
    stream.on('error', function(err, code) { 
      console.log('uhoh got a twitter stream error: ' + err + ' ; ' + code);
    });
    stream.on('limit', function(l) {
      console.log('whoops we got limited by twitter: ' + l);
    });
  });

  server.listen(process.env.PORT || config.port || 3000);
}

function getConfig() {
  try {
    var configPath = path.join(__dirname, "config.json");
    return JSON.parse(fs.readFileSync(configPath));
  } catch(err) {
    var config = {
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
      access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      ia_access_key: process.env.IA_ACCESS_KEY,
      ia_secret_key: process.env.IA_SECRET_KEY,
    }
    console.log(config);
    return config;
  }
}

function tweet(t, sockets) {
  var p = new RegExp('http://t.co/[^ ]+', 'g');
  _.each(t.text.match(p), function(url) {
    unshorten(url, function(wikipediaUrl) {
      getArticle(wikipediaUrl, function(article) {
        if (article) {
          var tweetUrl = "http://twitter.com/" + t.user.screen_name + "/statuses/" + t.id_str;
          var msg = {
            "id": t.id_str,
            "url": tweetUrl,
            "text": t.text,
            "user": t.user.screen_name,
            "name": t.user.name,
            "avatar": t.user.profile_image_url,
            "created": t.created_at,
            "article": article,
            "tweet": t,
          };
          addLatest(msg);
          _.each(sockets, function(socket) {
            socket.emit('tweet', msg);
          });
        }
      });
    });
  });
}

function getArticle(url, callback) {
  match = url.match(/http:\/\/(..).wikipedia.org\/wiki\/(.+)/);
  if (match) {
    var lang = match[1];
    var origTitle = querystring.unescape(match[2]);
    var title = origTitle.replace(/_/g, ' ');
    var article = {language: lang, title: title, origTitle: origTitle, url: url};
    if (article.origTitle.match(/\.(jpg|png|jpeg|gif)$/)) {
      addImageThumbnail(article, callback);
    } else {
      addArticleSummary(article, callback);
    }
  }
}

function addLatest(msg) {
  latest.push(msg);
  if (latest.length > dumpSize) archive();
}

function archive() {
  var now = new Date();
  if (archiving && now - archiving < 60 * 1000) {
    console.log("looks like an archive is underway");
    return;
  }

  archiving = now;
  var name = "/" + dateformat(now, 'yyyymmddhhmmss') + '.json';
  var value = JSON.stringify(latest, null, 2);
  latest = [];

  var c  = ia.createClient({
    accessKey: config.ia_access_key, 
    secretKey: config.ia_secret_key,
    bucket: config.ia_bucket
  });
  c.addObject({name: name, value: value}, function() {
    console.log("archived " + name);
  });
}

function addArticleSummary(article, callback) {
  var opts = {
    url: 'http://' + article.language + '.wikipedia.org/w/api.php',
    json: true,
    headers: {'User-Agent': 'wikitweets <http://github.com/edsu/wikitweets'},
    qs: {
      action: 'parse',
      redirects: true,
      prop: 'text',
      page: article.origTitle,
      format: 'json'
    }
  };
  request.get(opts, function(e, r, data) {
    if (! (data && data.parse)) {
      console.log(e);
      console.log(r);
      console.log('no results for ' + opts['url']);
      return;
    }
    var html = "<div>" + data.parse.text['*'] + "</div>";
    jsdom.env(html, ['http://code.jquery.com/jquery-1.5.min.js'], 
      function(err, window) {
        $ = window.$
        var summary = $('div').children('p:first');
        summary.find('sup').remove();
        summary.find('a').each(function() {
          $(this)
            .attr('href', 'http://' + article.language + '.wikipedia.org' + $(this).attr('href'))
            .attr('target', 'wikipedia')
        });
        article.summary = summary.html();
        callback(article);
        // important to close window or else jsdom leaks memory
        window.close(); 
      }
    );
  });
}

function addImageThumbnail(article, callback) {
  var opts = {
    url: 'http://' + article.language + '.wikipedia.org/w/api.php',
    json: true,
    headers: {'User-Agent': 'wikitweets <http://github.com/edsu/wikitweets'},
    qs: {
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: 250,
      titles: article.origTitle,
      format: 'json'
    }
  };
  request.get(opts, function(e, r, data) {
    try {
      var pageId = _.keys(data.query.pages)[0];
      var thumbUrl = data.query.pages[pageId].imageinfo[0].thumburl
      article.summary = _.template('<a href="<%= url %>"><img src="<%= thumbUrl %>"></a>', {url: article.url, thumbUrl: thumbUrl});
      callback(article);
    } catch(err) {
      console.log("failed to fetch thumbnail for " + article.origTitle);
    }
  });
}

main();
