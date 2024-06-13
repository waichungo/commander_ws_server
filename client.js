import WebSocket from 'ws';
// const webSocket = new WebSocket('http://6609512592ae4c3f4cfe.appwrite.global:7070');
// const webSocket = new WebSocket('wss://free.blr2.piesocket.com/v3/1?api_key=Yvd3PEoeTLU8BWcgPa4OXc2o2Ow1MnLRcjI2844A&notify_self=1');
// const webSocket = new WebSocket('ws://6610f428ad2411cb1f30.appwrite.global:8000/');
// const webSocket = new WebSocket('wss://websocketsample.onrender.com');
const webSocket = new WebSocket('ws://localhost:8000?id=TYYTDSTEDSE5664');
webSocket.onmessage = (event) => {
    console.log('Message from server: ' + event.data);
};
var canRun = false;
webSocket.onopen = () => {
    canRun = true
};
webSocket.onclose = (d) => {
    var reas=d.reason
    canRun = false
}
webSocket.onerror = (err) => {
    console.log(JSON.stringify(err.message,"",4))
    canRun = false
}
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => { resolve(null) }, ms || 1000);
    })
}
async function run() {
    var no = 0;
    // while(webSocket.readyState!=webSocket.OPEN){
    //     await sleep(2000)
    // }
    for (; ;) {
        while (!canRun) {
            await sleep(2000);
        }
        no++;
        try {
            webSocket.send("example message " + no)
        } catch (e) { }
        await sleep(1000)
    }
}
run();