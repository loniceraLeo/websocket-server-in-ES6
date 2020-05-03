"use strict"

const nop = () => {};

/**
 * create data frames
 * @private
 * @class
 */
class Frames {
    constructor() {
        nop();
    }
    /**
     * factory function for creating text frame
     * @param {String} data 
     * @param {Boolean} masked 
     * @param {Boolean} fin
     * @param {Boolean} first
     * @returns {Buffer}
     */
    createTextFrame(data, masked, fin, first) {
        let payload = Buffer.from(JSON.parse(JSON.stringify(data)));
        let meta = this._buildMeta(fin, first ? 1 : 0, masked, payload);
        return Buffer.concat([meta, payload]);
    }
    /**
     * factory function for creating binary frame
     * @param {Buffer} data 
     * @param {Boolean} masked 
     * @param {Boolean} fin 
     * @param {Boolean} first 
     * @returns {Buffer}
     */
    createBinaryFrame(data, masked, fin, first) {
        let payload = Buffer.from(JSON.parse(JSON.stringify(data)));
        let meta = this._buildMeta(fin, first ? 2 : 0, masked, payload);
        return Buffer.concat([meta, payload]);
    }
    /**
     * factory function for creating close frame
     * @param {Number} code 
     * @param {String} reason 
     * @param {Boolean} masked 
     * @returns {Buffer}
     */
    createCloseFrame(code, reason, masked) {
        let temp = Buffer.alloc(2);
        temp.writeUInt16BE(code);
        let payload = Buffer.concat([temp, Buffer.from(reason)]);
        let meta = this._buildMeta(true, 8, masked, payload);
        return Buffer.concat([meta, payload]);
    }
    /**
     * factory function for creating ping frame
     * @param {Buffer} data 
     * @param {Boolean} masked
     * @returns {Buffer}
     */
    createPingFrame(data, masked) {
        let payload = Buffer.from(data);
        let meta = this._buildMeta(true, 9, masked, payload);
        return Buffer.concat([meta, payload]);
    }
    /**
     * factory function for creating pong frame
     * @param {Buffer} data 
     * @param {Boolean} masked 
     * @returns {Buffer}
     */
    createPongFrame(data, masked) {
        let payload = Buffer.from(data);
        let meta = this._buildMeta(true, 10, masked, payload);
        return Buffer.concat([meta, payload]);
    }
    /**
     * private method for creating meta data
     * @private
     * @param {Boolean} fin 
     * @param {Number} opcode 
     * @param {Boolean} masked 
     * @param {Buffer} payload
     * @returns {Buffer}
     */
    _buildMeta(fin, opcode, masked, payload) {
        let len = payload.length;
        let metaLen = 2 + (len < 126 ? 0 : (len < 65536 ? 2 : 8)) + (masked ? 4 : 0);
        let meta = Buffer.alloc(metaLen);
        meta[0] = (fin ? 128 : 0) + opcode;
        meta[1] = masked ? 128 : 0;
        if (len < 126) {
            meta[1] += len;
        } else if (len < 65536) {
            meta[1] += 126;
            meta.writeUInt16BE(len, 2);
        } else {
            meta[1] += 127;
            meta.writeUInt32BE(len >> 32, 2);
            meta.writeUInt32BE(len % (2 ** 32), 6);
        }
        if (masked) {
            for (let i = 0; i < 4; ++i) {
                meta[metaLen - 4 + i] = Math.floor(Math.random() * 256);
            }
            for (let i = 0; i < len; ++i) {
                payload[i] ^= meta[metaLen - 4 + i % 4];
            }
        }
        return meta;
    }
}

module.exports = Frames;