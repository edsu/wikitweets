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
var dumpSize = 1000;
var archiving = false;

function main() {
  var app = express();
  var server = http.createServer(app);
  var io = socketio.listen(server);

  app.use(express.static(__dirname + '/public'));

  io.sockets.on('connection', function(socket) {
    _.each(latest, function(t) {socket.emit('tweet', t);});
  });

  var tweets = new twitter(getConfig());
  tweets.stream('statuses/filter', {track: 'wikipedia'}, function(stream) {
    stream.on('data', function(t) {
      tweet(t, io);
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
  // looks in a json file or the environment for some config info
  try {
    var configPath = path.join(__dirname, "config.json");
    return JSON.parse(fs.readFileSync(configPath));
  } catch(err) {
    var config = {
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
      access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      ia_bucket: process.env.IA_BUCKET,
      ia_access_key: process.env.IA_ACCESS_KEY,
      ia_secret_key: process.env.IA_SECRET_KEY,
    }
    console.log(config);
    return config;
  }
}

function tweet(t, io) {
  if (! t.entities || ! t.entities.urls) return;
  console.log("got tweet: " + t.id_str);
  _.each(t.entities.urls, function(urlObj) {
    url = urlObj.expanded_url;
    unshorten(url, function(wikipediaUrl) {
      getArticle(wikipediaUrl, function(article) {
        if (article) {
          console.log("got article: " + article.title);
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
          io.sockets.emit('tweet', msg);
        }
      });
    });
  });
}

function getArticle(url, callback) {
  var match = url.match(/https?:\/\/(..)\.(m\.)?wikipedia.org\/wiki\/(.+)/);
  var diffMatch = url.match(/(..)\.wikipedia\.org\/w\/index.php?diff=(\d+)&oldid=(\d+)/);
  if (match) {
    var lang = match[1];
    var origTitle = querystring.unescape(match[3]);
    var title = origTitle.replace(/_/g, ' ');
    var article = {language: lang, title: title, origTitle: origTitle, url: url};
    if (article.origTitle.match(/\.(jpg|png|jpeg|gif)$/)) {
      addImageThumbnail(article, callback);
    } else {
      addArticleSummary(article, callback);
    }
  } else if (diffMatch) {
    var lang = match[1];
    var id = match[2];
    var diff = {language: lang, url: url, id: id};
    addDiff(diff, callback);
  }
}

function addLatest(msg) {
  latest.push(msg);
  if (latest.length > 25) {
    latest = latest.slice(-25);
  }
}

function addDiff(diff, callback) {
  diff.title = "edit: " + diff.id;
  callback(diff);
}

function addArticleSummary(article, callback) {
  var opts = {
    url: 'https://' + article.language + '.wikipedia.org/w/api.php',
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

if (! module.parent) {
  main();
}
