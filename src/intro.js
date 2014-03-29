"use strict";

var crypto        = require( "crypto" ),
    defaultConfig = require( __dirname + "/../config.json" ),
    util          = require( "keigai" ).util,
    array         = util.array,
    clone         = util.clone,
    coerce        = util.coerce,
    delay         = util.delay,
    iterate       = util.iterate,
    lru           = util.lru,
    number        = util.number,
    merge         = util.merge,
    parse         = util.parse,
    json          = util.json,
    request       = util.request,
    string        = util.string,
    uuid          = util.uuid,
    fs            = require( "fs" ),
    http          = require( "http" ),
    https         = require( "https" ),
    http_auth     = require( "http-auth" ),
    mime          = require( "mime" ),
    moment        = require( "moment" ),
    syslog        = require( "node-syslog" ),
    zlib          = require( "zlib" ),
    ALL           = "all",
    STALE         = 60000,
    REGEX_BODY    = /^(put|post|patch)$/i,
    REGEX_COMP    = /javascript|json|text|xml/,
    REGEX_CSV     = /text\/csv/,
    REGEX_ENDSLSH = /\/$/,
    REGEX_ENDSMCN = /;$/,
    REGEX_EXT     = /\.[\w+]{1,}$/, // 1 is for source code files, etc.
    REGEX_HEAD    = /^(head|options)$/i,
    REGEX_HEAD2   = /head|options/i,
    REGEX_HEADKEY = /:.*/,
    REGEX_HEADVAL = /.*:\s+/,
    REGEX_GET     = /^(get|head|options)$/i,
    REGEX_DEL     = /^(del)$/i,
    REGEX_DEF     = /deflate/,
    REGEX_DIR     = /\/$/,
    REGEX_GZIP    = /gz/,
    REGEX_IE      = /msie/i,
    REGEX_IDEVICE = /ipad|iphone|ipod/i,
    REGEX_SAFARI  = /safari\//i,
    REGEX_CHROME  = /chrome\/|chromium\//i,
    REGEX_JSON    = /json/,
    REGEX_JSONWRP = /^[\[\{]/,
    REGEX_NEXT    = /\..*/,
    REGEX_NOCACHE = /no-store|no-cache/i,
    REGEX_NVAL    = /;.*/,
    REGEX_NUMBER  = /\d{1,}/,
    REGEX_PRIVATE = /private/,
    REGEX_REFUSED = /ECONNREFUSED/,
    REGEX_RENAME  = /^rename$/,
    REGEX_SPACE   = /\s+/,
    REGEX_STREAM  = /application|audio|chemical|conference|font|image|message|model|xml|video/,
    REGEX_REWRITE;

// Hooking syslog output
syslog.init( "turtle_io", syslog.LOG_PID | syslog.LOG_ODELAY, syslog.LOG_LOCAL0 );
