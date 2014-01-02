/**
 * Proxies a URL to a route
 *
 * @method proxy
 * @param  {String}  route  Route to proxy
 * @param  {String}  origin Host to proxy (e.g. http://hostname)
 * @param  {String}  host   [Optional] Hostname this route is for (default is all)
 * @param  {Boolean} stream [Optional] Stream response to client (default is false)
 * @return {Object}         TurtleIO instance
 */
TurtleIO.prototype.proxy = function ( route, origin, host, stream ) {
	var self  = this,
	    verbs = ["delete", "get", "post", "put", "patch"];

	/**
	 * Response handler
	 *
	 * @method handle
	 * @private
	 * @param  {Object} req HTTP(S) request Object
	 * @param  {Object} res HTTP(S) response Object
	 * @param  {Mixed}  arg Proxy response
	 * @param  {Object} xhr XmlHttpRequest
	 * @return {Undefined}  undefined
	 */
	function handle ( req, res, arg, xhr ) {
		var etag          = "",
		    regex         = /("|')\/[^?\/]/g,
		    regex_quote   = /^("|')/,
		    regexOrigin   = new RegExp( origin, "g" ),
		    replace       = "$1" + route,
		    url           = req.parsed.href,
		    delay         = $.expires,
		    get           = req.method === "GET",
		    rewriteOrigin = req.parsed.protocol + "//" + req.parsed.host + route,
		    resHeaders, rewrite;

		resHeaders        = headers( xhr.getAllResponseHeaders() );
		resHeaders.Server = self.config.headers.Server;

		// Something went wrong
		if ( xhr.status < self.codes.CONTINUE ) {
			self.error( req, res, self.codes.BAD_GATEWAY );
		}
		else if ( xhr.status >= self.codes.SERVER_ERROR ) {
			self.error( req, res, xhr.status );
		}
		else {
			if ( get && ( xhr.status === self.codes.SUCCESS || xhr.status === self.codes.NOT_MODIFIED ) && !$.regex.no.test( resHeaders["Cache-Control"] ) && !$.regex.priv.test( resHeaders["Cache-Control"] ) ) {
				// Determining how long rep is valid
				if ( resHeaders["Cache-Control"] && $.regex.number_present.test( resHeaders["Cache-Control"] ) ) {
					delay = $.number.parse( $.regex.number_present.exec( resHeaders["Cache-Control"] )[0], 10 );
				}
				else if ( resHeaders.Expires !== undefined ) {
					delay = new Date( resHeaders.Expires ).diff( new Date() );
				}

				if ( delay > 0 ) {
					// Removing from LRU when invalid
					$.delay( function () {
						self.unregister( url );
					}, delay, url );
				}
			}

			if ( xhr.status !== self.codes.NOT_MODIFIED ) {
				rewrite = REGEX_REWRITE.test( ( resHeaders["Content-Type"] || "" ).replace( REGEX_NVAL, "" ) );

				// Setting headers
				if ( get && xhr.status === self.codes.SUCCESS ) {
					etag = resHeaders.Etag || "\"" + self.etag( url, resHeaders["Content-Length"] || 0, resHeaders["Last-Modified"] || 0, self.encode( arg ) ) + "\"";

					if ( resHeaders.Etag !== etag ) {
						resHeaders.Etag = etag;
					}
				}

				if ( resHeaders.Allow === undefined || resHeaders.Allow.isEmpty() ) {
					resHeaders.Allow = resHeaders["Access-Control-Allow-Methods"] || "GET";
				}

				// Determining if a 304 response is valid based on Etag only (no timestamp is kept)
				if ( get && req.headers["if-none-match"] === etag ) {
					self.respond( req, res, self.messages.NO_CONTENT, self.codes.NOT_MODIFIED, resHeaders );
				}
				else {
					if ( REGEX_HEAD.test( req.method.toLowerCase() ) ) {
						arg = self.messages.NO_CONTENT;
					}
					// Fixing root path of response
					else if ( rewrite ) {
						if ( arg instanceof Array || arg instanceof Object ) {
							arg = $.encode( arg ).replace( regexOrigin, rewriteOrigin );

							if ( route !== "/" ) {
								arg = arg.replace( /"(\/[^?\/]\w+)\//g, "\"" + route + "$1/" );
							}

							arg = $.decode( arg );
						}
						else if ( typeof arg == "string" ) {
							arg = arg.replace( regexOrigin, rewriteOrigin );

							if ( route !== "/" ) {
								arg = arg.replace( regex, replace + ( arg.match( regex ) || [""] )[0].replace( regex_quote, "" ) );
							}
						}
					}

					self.respond( req, res, arg, xhr.status, resHeaders );
				}
			}
			else {
				self.respond( req, res, arg, xhr.status, resHeaders );
			}
		}
	}

	/**
	 * Capitalizes HTTP headers
	 *
	 * @method headers
	 * @private
	 * @param  {Object} args Response headers
	 * @return {Object}      Reshaped response headers
	 */
	function headers ( args ) {
		var result = {};

		if ( !args.isEmpty() ) {
			args.trim().split( "\n" ).each( function ( i ) {
				var header, value;

				value          = i.replace( $.regex.header_value_replace, "" );
				header         = i.replace( $.regex.header_replace, "" );
				header         = header.unhyphenate( true ).replace( /\s+/g, "-" );
				result[header] = !isNaN( value ) ? Number( value ) : value;
			} );
		}

		return result;
	}

	/**
	 * Wraps the proxy request
	 *
	 * @method wrapper
	 * @private
	 * @param  {Object} req HTTP(S) request Object
	 * @param  {Object} res HTTP(S) response Object
	 * @return {Undefined}  undefined
	 */
	function wrapper ( req, res ) {
		var url      = origin + ( route !== "/" ? req.url.replace( new RegExp( "^" + route ), "" ) : req.url ),
		    method   = req.method.toLowerCase(),
		    headerz  = $.clone( req.headers, true ),
		    parsed   = $.parse( url ),
		    mimetype = mime.lookup( parsed.pathname ),
		    fn, options, proxyReq;

		// Facade to handle()
		fn = function ( arg, xhr ) {
			handle( req, res, arg, xhr );
		};

		// Streaming formats that do not need to be rewritten
		if ( !stream && ( REGEX_EXT.test( parsed.pathname ) && !REGEX_JSON.test( mimetype ) ) && REGEX_STREAM.test( mimetype ) ) {
			stream = true;
		}

		// Stripping existing authorization header because it's not relevant for the remote system
		delete headerz.authorization;

		// Identifying proxy behavior
		headerz["x-host"]             = parsed.host;
		headerz["x-forwarded-for"]    = ( headerz["x-forwarded-for"] ? headerz["x-forwarded-for"] + ", " : "" ) + req.connection.remoteAddress;
		headerz["x-forwarded-proto"]  = parsed.protocol.replace( ":", "" );
		headerz["x-forwarded-server"] = self.config.headers.Server;

		// Streaming response to Client
		if ( stream ) {
			headerz.host = req.headers.host;

			options = {
				headers  : headerz,
				hostname : parsed.hostname,
				method   : req.method,
				path     : parsed.path,
				port     : parsed.port || 80
			};

			if ( !parsed.auth.isEmpty() ) {
				options.auth = parsed.auth;
			}

			proxyReq = http.request( options, function ( proxyRes ) {
				res.writeHeader(proxyRes.statusCode, proxyRes.headers);
				proxyRes.pipe( res );
			} );

			proxyReq.on( "error", function ( e ) {
				self.error( req, res, /ECONNREFUSED/.test( e.message ) ? self.codes.SERVER_UNAVAILABLE : self.codes.SERVER_ERROR );
			} );

			if ( REGEX_BODY.test( req.method ) ) {
				proxyReq.write( req.body );
			}

			proxyReq.end();
		}
		// Acting as a RESTful proxy
		else {
			// Removing support for compression so the response can be rewritten (if textual)
			delete headerz["accept-encoding"];

			if ( REGEX_BODY.test( req.method ) ) {
				url[method]( fn, fn, req.body, headerz );
			}
			else if ( REGEX_DEL.test( method ) ) {
				url.del( fn, fn, headerz );
			}
			else if ( REGEX_HEAD.test( method ) ) {
				if ( method === "head" ) {
					method = "headers";
				}

				url[method]( fn, fn );
			}
			else {
				url.get( fn, fn, headerz );
			}
		}
	}

	stream = ( stream === true );

	// Setting route
	verbs.each( function ( i ) {
		if ( route === "/" ) {
			self[i]( "/.*", wrapper, host );
		}
		else {
			self[i]( route, wrapper, host );
			self[i]( route + "/.*", wrapper, host );
		}
	} );

	return this;
};