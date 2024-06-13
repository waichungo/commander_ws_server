import http from 'http'

import fs from "fs"
import ws from 'websocket'
import  express from  "express"
import crypto from "crypto"
var WebSocketServer = ws.server;
var connections = {}
const port = process.env.PORT || 8000
const app = express()
var server = http.createServer(app);

const wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});



async function start() {
    server.listen(port, function () {
        console.log((new Date()) + `Server is listening on http://localhost:${port}`);
    });
}

wsServer.on('request', function (request) {
    try {
        var id = request.resourceURL.query["id"]?.trim()
        if (!id) {
            request.reject(406, "Invalid id found")
            return
        }
        if (connections[id]) {
            request.reject(429, "Connection already exists")
            return
        }
        id = decodeURIComponent(id)
        var connection = request.accept(null, request.origin);
        var headers = request.httpRequest.headers
        connections[id] = connection
        console.log((new Date()) + ' Connection accepted.');
        connection.on('message', function (message) {
            if (message.type === 'utf8') {
                try {
                    let msg = message.utf8Data
                    try {
                        msg = JSON.parse(message.utf8Data)
                        if (msg["recepient"]) {
                            let recepient = connections[msg["recepient"]]
                            if (recepient) {
                                recepient.send(message.utf8Data)
                            } else {
                                connection.send("Error: Recepient with id " + msg["recepient"] + " does not ecist")
                            }

                        } else {
                            connection.send("Error: no recepient specified")
                        }
                    } catch (error) {
                        console.error(error)
                    }
                    connection.send(msg)
                } catch (err) {
                    console.error(err);
                }
            }
            else if (message.type === 'binary') {

            }
        });

        connection.on('close', function (reasonCode, description) {
            delete connections[id]
            var err = (new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.' + ` with code '${reasonCode}' and cause '${description}'`;
            console.error(err)
        });
    } catch (error) {
        console.error(error)
    }
});

start()

// function encryptString(text, key, iv) {
//     const cipher = crypto.createCipheriv("aes-128-cbc", key, iv)
//     return Buffer.from(
//         cipher.update(data, 'utf8', 'hex') + cipher.final('hex')
//     ).toString('base64')
// }