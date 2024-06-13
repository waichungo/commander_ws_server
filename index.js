import http from 'http'

import fs from "fs"
import ws from 'websocket'
import express from "express"
import crypto from "crypto"
import protobuf from 'protocol-buffers'

// pass a proto file as a buffer/string or pass a parsed protobuf-schema object
var proto = protobuf(fs.readFileSync('model.proto'))
var WebSocketServer = ws.server;
var connections = {}
const port = process.env.PORT || 8000
const app = express()
var server = http.createServer(app);

const wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

const MC_CONNECTEDCLIENTS = 21;
const MC_CONNECTIONS = 40;
const MC_ERROR = 1;
const WS_SERVER_PING = 48;

function encryptString(text, key, iv) {
    key = key || ""
    let keyBuff = Buffer.from(key)
    let rem = key.length % 16
    if (rem > 0) {
        let pad = 16 - rem
        keyBuff = Buffer.concat([keyBuff, Buffer.from(Array(pad).fill(0))])
    }
    iv = iv || ""
    let ivBuff = Buffer.from(iv)
    rem = iv.length % 16
    if (rem > 0) {
        let pad = 16 - rem
        ivBuff = Buffer.concat([ivBuff, Buffer.from(Array(pad).fill(0))])
    }

    const cipher = crypto.createCipheriv("aes-128-cbc", keyBuff, ivBuff)
    cipher.setAutoPadding(false)
    let origLn = text.length
    let txtBuff = Buffer.from(text)
    let lnBuff = Buffer.from(numberToBytes(origLn))

    let remP = text.length % 16;
    let padP = 16 - remP;

    if (remP > 0) {
        txtBuff = Buffer.concat([txtBuff, Buffer.from(Array(padP).fill(0))])
    }
    txtBuff = Buffer.concat([txtBuff, Buffer.from(Array(8).fill(0)), lnBuff])
    let encrypted = cipher.update(txtBuff, 'utf8', 'base64url')
    encrypted += cipher.final("base64url")
    return encrypted
}
function getIntArrayLen(no) {
    let len = 1;
    let delta = no;
    while (delta > 255) {
        delta = Math.round(delta /= 255)
        len++
    }
    return len;

}
function numberToBytes(no) {
    let arr = Array(8).fill(0)
    const ln = getIntArrayLen(no)
    for (let i = 0; i < ln; i++) {
        let seg = (no >> (i * 8))
        arr[i] = seg & 255;
    }
    return arr;
}
function bytesToNumber(bytes) {
    let result = 0
    for (let i = 0; i < 8; i++) {
        result += bytes[i] << (i * 8)
    }
    return result
}
function decryptString(text, key, iv) {
    key = key || ""
    let keyBuff = Buffer.from(key)
    let rem = key.length % 16
    if (rem > 0) {
        let pad = 16 - rem
        keyBuff = Buffer.concat([keyBuff, Buffer.from(Array(pad).fill(0))])
    } 3
    iv = iv || ""
    let ivBuff = Buffer.from(iv)
    rem = iv.length % 16
    if (rem > 0) {
        let pad = 16 - rem
        ivBuff = Buffer.concat([ivBuff, Buffer.from(Array(pad).fill(0))])
    }

    const decipher = crypto.createDecipheriv("aes-128-cbc", keyBuff, ivBuff)
    let decrypted = decipher.update(text, 'base64url', 'utf8')
    let decBuff = Buffer.from(decrypted, "base64url")
    let bin2 = decipher.final("base64url")
    return decrypted
}
async function start() {
    // let arr = numberToBytes(135866)
    // let no = bytesToNumber(arr)
    let msg = "A good house is one that costs over KES 29,0000"
    let encrypted = encryptString(msg, "?>7*%e9on&$%$9", "78yutojfnp[rhdyu")
    // let decrypted = decryptString(encrypted, "?>7*%e9on&$%$9", "78yutojfnp[rhdyu")
    server.listen(port, function () {
        console.log((new Date()) + `Server is listening on http://localhost:${port}`);
    });
}


wsServer.on('request', function (request) {
    try {
        var id = request.resourceURL.query["id"]?.trim()
        if (!id) {
            request.reject(401, "Invalid id found")
            return
        }
        if (connections[id]) {
            request.reject(429, "Connection already exists")
            return
        }
        var cl = request.resourceURL.query["client"]?.trim()?.toLowerCase()
        var isClient = (cl != null && cl != undefined) && cl == "true"
        id = decodeURIComponent(id)
        var connection = request.accept(null, request.origin);
        var headers = request.httpRequest.headers
        connections[id] = {
            "socket": connection,
            "isClient": isClient,
        }
        console.log((new Date()) + ' Connection accepted.');
        // let timer= setInterval(()=>{
        //     let msg = {}
        //     let tmpRec = msg["recepient"] 
        //     msg["code"] =10;
        //     msg["sender"] = "SERVER";
        //     msg["recepient"] = id;
        //     msg["data"] = String.raw`D:\projects\dhunt\bin\Debug\net8.0`;
        //     connection.send(JSON.stringify(msg))
        // },5000)
        connection.on('message', function (message) {
            if (message.type === 'utf8') {
                try {
                    let msg = message.utf8Data
                    try {
                        msg = JSON.parse(message.utf8Data)
                        if (msg["recepient"]) {
                            let recepient = connections[msg["recepient"]]
                            if (msg["code"] == MC_CONNECTEDCLIENTS || msg["code"] == MC_CONNECTIONS) {
                                let clientOnly = msg["code"] == MC_CONNECTEDCLIENTS
                                let conns = []
                                for (let key in connections) {
                                    if (clientOnly) {
                                        if (connections[key].isClient) {
                                            conns.push(key)
                                        }
                                    } else {
                                        conns.push(key)
                                    }
                                }
                                msg["sender"] = "SERVER";
                                msg["recepient"] = id;
                                msg["data"] = JSON.stringify(conns);

                                connection.send(JSON.stringify(msg));
                                return
                            } else if (msg["code"] == WS_SERVER_PING) {
                                msg["code"] = WS_SERVER_PING;
                                msg["sender"] = "SERVER";
                                msg["recepient"] = id;
                                msg["data"] = "";

                                connection.send(JSON.stringify(msg));
                                return
                            }
                            if (recepient) {
                                recepient.socket.send(message.utf8Data)
                            } else {
                                msg = {}
                                let tmpRec = msg["recepient"]
                                msg["code"] = MC_ERROR;
                                msg["sender"] = "SERVER";
                                msg["recepient"] = id;
                                msg["data"] = "Error: Recepient with id " + tmpRec + " does not exist";
                                connection.send(JSON.stringify(msg));
                            }

                        } else {
                            msg = {}
                            msg["code"] = MC_ERROR
                                ;
                            msg["sender"] = "SERVER";
                            msg["recepient"] = id;
                            msg["data"] = "Error: no recepient specified"

                            connection.send(JSON.stringify(msg));
                        }
                    } catch (error) {
                        console.error(error);
                        msg = {}
                        msg["code"] = MC_ERROR
                            ;
                        msg["sender"] = "SERVER";
                        msg["recepient"] = id;
                        msg["data"] = "Invalid message type.Required a parsable json string"

                        connection.send(JSON.stringify(msg));
                    }
                } catch (err) {
                    console.error(err);
                }
            }
            else if (message.type === 'binary') {
                try {
                    let msg = proto.BinaryMessage.decode(message.binaryData);
                    // console.log(msg)
                    let recepient = connections[msg["recepient"]]
                    if (recepient) {
                        recepient.socket.send(message.binaryData)
                    } else {
                        msg = {}
                        let tmpRec = msg["recepient"]
                        msg["code"] = MC_ERROR;
                        msg["sender"] = "SERVER";
                        msg["recepient"] = id;
                        msg["data"] = "Error: Recepient with id " + tmpRec + " does not exist";
                        connection.send(JSON.stringify(msg));
                    }
                } catch (err) {
                    console.error(err)
                }
            }
        });

        connection.on('close', function (reasonCode, description) {
            try {
                delete connections[id]
                // clearTimeout(timer)
                var err = (new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.' + ` with code '${reasonCode}' and cause '${description}'`;
                console.error(err)
            } catch (err) { }
        });
    } catch (error) {
        console.error(error)
    }
});
app.get("/", (request, response) => {
    response.send("Works")
})
start()

