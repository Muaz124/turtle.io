/**
 * Sets a handler
 *
 * @method handler
 * @param  {String}   method HTTP method
 * @param  {String}   route  RegExp pattern
 * @param  {Function} fn     Handler
 * @param  {String}   host   [Optional] Virtual host, default is `all`
 * @return {Object}          TurtleIO instance
 */
TurtleIO.prototype.handler = function ( method, route, fn, host ) {
	host = host || ALL;

	if ( this.handlers.all.hosts[host] === undefined ) {
		this.host( host );
	}

	if ( !array.contains( this.handlers[method].routes, route ) ) {
		this.handlers[method].routes.push( route );
		this.handlers[method].regex.push( new RegExp( "^" + route + "$" ) );
	}

	if ( this.handlers[method].hosts[host][route] === undefined ) {
		this.handlers[method].hosts[host][route] = fn;
	}

	return this;
};
