"use strict"

const net = require('net');
const tls = require('tls');
const {EventEmitter} = require('events');
const Connection = require('./Connection');

const nop = () => {};

/**
 * create a websocket Server
 * @class
 */
class Server extends EventEmitter{
/**
 * constructor for creating a websocket server
 * @param {Object} options 
 * @param {Function} callback 
 * @returns {Object} 
 */
    constructor(options, callback) {  
        super();  //super constructor
        let that = this;

        this.connections = [];  //alive connections

        if (arguments.length > 2) {
            throw new Error('Too many arguments');
        }
        if (typeof options == 'function') {
            callback = options;
            options = {};
        } else if (arguments.length == 0) {
            options = {};
        }
        let secure = options.secure;
        secure = secure == undefined ? false : secure;
        //console.log(options);
        let _onConnection = socket => {
            let conn = new Connection(socket, () => {
                this.connections.push(conn);
                conn.removeListener('error', nop);
                that.emit('connection', conn);
            }).on('close', () => {
               that.connections.splice(that.connections.indexOf(conn), 1);
            })

            conn.on('error', nop);
        }
        if (secure) {
            this.socket = tls.createServer(options, _onConnection);
        } else {
            this.socket = net.createServer(options, _onConnection);
        }
        this.socket.on('close', () => {
            this.emit('close');
        });
        this.socket.on('error', e => {
            this.emit('error', e);
        });

        callback = callback == undefined ? nop : callback;
        this.on('connection', callback);
        return this;
    }
/**
 * get all connections on the server
 * @returns {Array}
 */
    getConnections() {
        return this.connections;
    }
/**
 * listen for new connection
 * @param {Number|Object} port 
 * @param {String|undefined} host 
 * @param {function} callback 
 * @returns {Object}
 */
    listen(port, host, callback) {
        let _port = port, _host = host;
        if (typeof port == 'object') {
            callback = host;
            _port = port.port;
            _host = port.host;
        } else if (typeof host == 'function') {
            callback = host;
            _host = 'localhost';
        } 
        _port = _port == undefined ? 80 : _port;
        _host = _host == undefined ? 'localhost' : _host;
        callback = callback == undefined ? nop : callback;
        this.on('listening', callback);
        this.socket.listen(_port, _host, () => {
            this.emit('listening');
        });

        return this;
    }
/**
 * close the server, which indicates that no connection will be responsed in the future
 * @param {Function} callback 
 */
    close(callback) {
        callback = callback == undefined ? nop : callback;
        this.once('close', callback);
        this.socket.close();    //close the tcp connection
    }
}

module.exports = Server;