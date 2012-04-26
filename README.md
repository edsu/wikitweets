wikitweets
==========

wikitweets is a [Node](http://nodejs.org) web application that streams Tweets
that reference Wikipedia to the browser. 

How Does It Work?
-----------------

wikitweets uses the [Twitter Streaming API](https://dev.twitter.com/docs/streaming-api/methods) to filter out tweets that include links to Wikipedia. It's nice that Twitter allows their filtering and search API calls to work off of the original (unshortened) urls. The Twitter API does not however included the unshortened URLs in the API response, so those are looked up in order to determine which article is being referenced in which Wikipedia. wikitweets then looks up the article using the relevant language Wikipedia API to get the wikipedia article summary. The mashup of relevant bits from the tweet and the wikipedia article are then streamed to the browser.

Thanks
------

wikistream is remarkabley compact given all that is going on. This is because
it stands on several giants shoulders, thanks giants!

* [express](http://expressjs.com/)
* [socket.io](http://socket.io)
* [ntwitter](https://github.com/AvianFlu/ntwitter)
* [request](https://github.com/mikeal/request)
* [unshorten](https://github.com/mathiasbynens/node-unshorten)
* [underscore](http://documentcloud.github.com/underscore/)

Install
-------

* install node and git
* git clone https://github.com/edsu/wikistream.git
* cd wikistream
* npm install
* cp config.json.tmpl config.json
* get [twitter](https://dev.twitter.com/apps/new) credentials and add them to config.json
* node app.js
* open http://localhost:3000/

Licnse
------

* CC0
