wikitweets
==========

wikitweets is a [Node](http://nodejs.org) web application that streams Tweets
that reference Wikipedia to the browser. 

How Does It Work?
-----------------

wikitweets uses the [Twitter Streaming API](https://dev.twitter.com/docs/streaming-api/methods) to filter out tweets that include links to Wikipedia. It is convenient that Twitter's filtering and search API calls are able to use of the original (unshortened) URLs. The Twitter API does not include the unshortened URLs in the API response JSON, so those are looked up in order to determine which article is being referenced in which Wikipedia. wikitweets then looks up the article using the relevant language Wikipedia API to get the wikipedia article summary. The mashup of relevant bits from the tweet and the wikipedia article are then streamed to the browser.

Thanks
------

wikitweets stands on several giants shoulders, including:

* [express](http://expressjs.com/)
* [socket.io](http://socket.io)
* [ntwitter](https://github.com/AvianFlu/ntwitter)
* [request](https://github.com/mikeal/request)
* [unshorten](https://github.com/mathiasbynens/node-unshorten)
* [underscore](http://documentcloud.github.com/underscore/)

Install
-------

* install node and git
* `git clone https://github.com/edsu/wikistream.git`
* `cd wikistream`
* `npm install`
* `cp config.json.tmpl config.json`
* get [twitter](https://dev.twitter.com/apps/new) credentials and add them to config.json
* `node app.js`
* open http://localhost:3000/ in browser

Licnse
------

* CC0
