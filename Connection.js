"use strict"

//The max value of javascript is 2^53 

const {
    EventEmitter
} = require('events');
const crypto = require('crypto');
const Frame = require('./frame');

const nop = () => {};

let frames = new Frame();
/**
 * The Connection object is a encapsulated socket
 * @class
 */
class Connection extends EventEmitter {
    /**
     * four states of the connection
     * @private
     * @constants
     */
    static CONNECTING = 'CONNECTION';
    static OPENING = 'OPENING';
    static CLOSING = 'CLOSING';
    static CLOSED = 'CLOSED';
    /**
     * fragments
     * @constant
     */
    static binaryFragment = 512 * 1024;
    static textFragment = 256 * 1024;
    /**
     * constructor for creating a connection
     * @param {Object} socket 
     * @param {Function} callback 
     */
    constructor(socket, callback) {
        super();
        let that = this;

        this.headers = {};
        this.buffer = Buffer.alloc(0);
        this.readyState = Connection.CONNECTING;
        this.socket = socket;

        this.socket.on('data', buf => {
            if (this.readyState == Connection.CONNECTING) {
                this.extractHeaders(buf.toString());
                this.socket.write(this._buildResponse(this.headers['Sec-WebSocket-Key']), callback);
                this.readyState = Connection.OPENING;
            } else {
                let [fin, opcode, buffer] = this.extractFrame(buf);
                if (fin == 8) {  //Read
                    if (opcode == 0 || opcode == 1 || opcode == 2) {
                        this.buffer = Buffer.concat([this.buffer, buffer]);
                    }
                    switch (opcode) {
                        case 0:
                            break;
                        case 1:
                            that.emit('text', this.buffer.toString());
                            this.buffer = Buffer.alloc(0);
                            break;
                        case 2:
                            that.emit('binary', this.buffer);
                            this.buffer = Buffer.alloc(0);
                            break;

                        case 8:
                            this.socket.end();
                            this.readyState = Connection.CLOSED;
                            that.emit('close', buffer.readUInt16BE(0)); //Close Code
                            break;
                        case 9:
                            that.processPing(this.buffer);
                            break;
                        case 10:
                            nop();
                            break;
                        default:
                            that.emit('error', new Error('invalid opcode'));
                    }
                } else {
                    this.buffer = Buffer.concat([this.buffer, buffer]);
                    return;
                }
            }
        });
    }
    /**
     * extract data from buffer(server-side)
     * @private
     * @param {Buffer} buf 
     * @returns {Array}
     */
    extractFrame(buf) {
        //the frame from client to server is always masked
        let fin = buf[0] >> 4,
            opcode = buf[0] % 16,
            start = 2,
            len,
            mask = Buffer.alloc(4);

        if (buf[1] % 128 < 126) {
            len = buf[1] % 128;
        } else if (buf[1] % 128 == 126) {
            start += 2;
            len = buf.readUInt16BE(2);
        } else {
            start += 8;
            len = buf.readUInt32BE(2) << 32 + buf.readUInt32BE(6);
        }
        for (let i = 0; i < 4; ++i) {
            mask[i] = buf[start + i];
        }
        start += 4;
        for (let i = start; i < buf.length; ++i) {
            buf[i] ^= mask[(i - start) % 4];
        }
        buf = buf.slice(start);
        return [fin, opcode, buf];
    }
    /**
     * send text to the client
     * @param {String} data 
     * @param {Function} callback 
     */
    sendText(data, callback) {
        let interval = Connection.textFragment;
        if (this.readyState == Connection.OPENING) {
            for (let i = 0; i < data.length; i += interval) {
                let buf = frames.createTextFrame(data.slice(i, i + interval), false, (i + interval) < data.length ? false : true, i == 0 ? true : false);
                this.socket.write(buf, callback == undefined ? nop : callback);
            }
        } else {
            this.emit('error', new Error('The connection is not opening'));
        }
    }
    /**
     * send binary to the client
     * @param {Buffer} data 
     * @param {Function} callback 
     */
    sendBinary(data, callback) {
        let interval = Connection.binaryFragment;
        if (this.readyState == Connection.OPENING) {
            for (let i = 0; i < data.length; i += interval) {
                let buf = frames.createBinaryFrame(data.slice(i, i + interval), false, (i + interval) < data.length ? false : true, i == 0 ? true : false);
                this.socket.write(buf, callback == undefined ? nop : callback);
            }
        } else {
            this.emit('error', new Error('The connection is not opening'));
        }
    }
    /**
     * send a ping to a clinet
     * @param {Buffer} data 
     * @param {Function} callback 
     */
    sendPing(data, callback) {
        if (this.readyState == Connection.OPENING) {
            let buf = frames.createPingFrame(data, false);
            this.socket.write(buf, callback == undefined ? nop : callback);
        } else {
            this.emit('error', new Error('The connection is not opening'));
        }
    }

    /**
     * process a pong frame to response the ping from client
     * @private
     * @param {Buffer} buf 
     * @param {Function} callback
     */
    processPing(buf, callback) {
        if (this.readyState == Connection.OPENING) {
            let [buffer] = this.extractFrame(buf);
            buffer = frames.createPongFrame(buffer, false);
            this.socket.write(buffer, callback == undefined ? nop : callback);
        } else {
            nop(); //do nothing if the connection is closing or closed
        }
    }
    /**
     * extract headers from raw data
     * @param {String} rawHeaders 
     */
    extractHeaders(rawHeaders) {
        let headers = rawHeaders.split('\r\n');
        this.headers['httpInfo'] = headers[0];
        for (let i = 1; i < rawHeaders.length; ++i) {
            if (!!headers[i]) {
                this.headers[headers[i].split(/:\s/)[0]] = headers[i].split(/:\s/)[1];
            }
        }
    }
    /**
     * complete a handshake to client
     * @private
     * @param {String} key 
     * @returns {String}
     */
    _buildResponse(key) {
        let content = '';
        let sha1 = crypto.createHash('sha1');
        content += 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n';
        sha1.on('data', result => {
            content += 'Sec-WebSocket-Accept: ' + result.toString('base64') + '\r\n\r\n';
        });
        sha1.end(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
        return content;
    }
}

module.exports = Connection;