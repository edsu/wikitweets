var fs = require('fs'),
    path = require('path'),
    jsdom = require('jsdom'),
    _  = require('underscore'),
    express = require('express'),
    request = require('request'),
    twitter = require('ntwitter'),
    socketio = require('socket.io'),
    unshorten = require('unshorten'),
    querystring = require('querystring');

var latest = [];

function main() {
  var config = getConfig();
  var sockets = [];

  var app = express.createServer();
  app.configure(function() {
    app.use(express.static(__dirname + '/public'));
  });

  var io = socketio.listen(app);
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
      tweet(t, sockets);
    });
  });

  app.listen(process.env.PORT || config.port);
}

function getConfig() {
  var configPath = path.join(__dirname, "config.json");
  return JSON.parse(fs.readFileSync(configPath));
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
            "article": article
          };
          addLatest(msg);
          console.log(msg);
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
    addArticleSummary(article, callback);
  }
}

function addLatest(msg) {
  latest.push(msg);
  latest = latest.slice(-10, latest.size);
}

function addArticleSummary(article, callback) {
  var opts = {
    url: 'http://' + article.language + '.wikipedia.org/w/api.php',
    json: true,
    headers: {'User-Agent': 'wikitweets <http://github.com/edsu/wikitweets'},
    qs: {
      action: 'parse',
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
        window.close();
      }
    );
  });
}

main();
