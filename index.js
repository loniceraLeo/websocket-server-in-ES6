"use strict"

const Server = require('./Server');

exports.createServer = (options, callback) => {
    return new Server(options, callback);
}