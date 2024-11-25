'use strict';


const SIGNAL_TYPE_JOIN = "join";
const SIGNAL_TYPE_RESP_JOIN = "resp-join";  // 告知加入者对方是谁
const SIGNAL_TYPE_LEAVE = "leave";
const SIGNAL_TYPE_NEW_PEER = "new-peer";
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";
const SIGNAL_TYPE_OFFER = "offer";
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";

var localUserId = Math.random().toString(36).substr(2); // 本地uid
var remoteUserId = -1;      // 对端
var roomId = 0;

var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");
var localStream=null;
var remoteStream = null;
var pc = null;


var husterRTCEngine ;

function handleIceCandidate(event) {
    console.info("handleIceCandidate");
    if (event.candidate) {
        var jsonMsg = {
            'cmd': 'candidate',
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid': remoteUserId,
            'msg': JSON.stringify(event.candidate)
        };
        var message = JSON.stringify(jsonMsg);
        husterRTCEngine.sendMessage(message);
        // console.info("handleIceCandidate message: " + message);
        console.info("send candidate message");
    } else {
        console.warn("End of candidates");
    }
}

function handleRemoteStreamAdd(event) {
    console.info("handleRemoteStreamAdd");
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
}

function handleConnectionStateChange() {
    if(pc != null) {
        console.info("ConnectionState -> " + pc.connectionState);
    }
}

function handleIceConnectionStateChange() {
    if(pc != null) {
        console.info("IceConnectionState -> " + pc.iceConnectionState);
    }
}

function createPeerConnection() {
    var defaultConfiguration = {  
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
        iceTransportPolicy:"all",//relay 或者 all
        // 修改ice数组测试效果，需要进行封装
        iceServers: [
            {
                "urls": [
                    "turn:192.168.1.118:3478?transport=udp",
                    "turn:192.168.1.118:3478?transport=tcp"       
                ],
                "username": "huster",
                "credential": "123456"
            },
            {
                "urls": [
                    "stun:192.168.1.118:3478"
                ]
            }
        ]
    };



    pc = new RTCPeerConnection(defaultConfiguration);
    pc.onicecandidate = handleIceCandidate;
    pc.ontrack = handleRemoteStreamAdd;
    pc.onconnectionstatechange = handleConnectionStateChange;
    pc.oniceconnectionstatechange = handleIceConnectionStateChange

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
}

function createOfferAndSendMessage(session) {
    pc.setLocalDescription(session)
        .then(function () {
            var jsonMsg = {
                'cmd': 'offer',
                'roomId': roomId,
                'uid': localUserId,
                'remoteUid': remoteUserId,
                'msg': JSON.stringify(session)
            };
            var message = JSON.stringify(jsonMsg);
            husterRTCEngine.sendMessage(message);
            // console.info("send offer message: " + message);
            console.info("send offer message");
        })
        .catch(function (error) {
            console.error("offer setLocalDescription failed: " + error);
        });

}

function handleCreateOfferError(error) {
    console.error("handleCreateOfferError: " + error);
}

function createAnswerAndSendMessage(session) {
    pc.setLocalDescription(session)
        .then(function () {
            var jsonMsg = {
                'cmd': 'answer',
                'roomId': roomId,
                'uid': localUserId,
                'remoteUid': remoteUserId,
                'msg': JSON.stringify(session)
            };
            var message = JSON.stringify(jsonMsg);
            husterRTCEngine.sendMessage(message);
            // console.info("send answer message: " + message);
            console.info("send answer message");
        })
        .catch(function (error) {
            console.error("answer setLocalDescription failed: " + error);
        });

}

function handleCreateAnswerError(error) {
    console.error("handleCreateAnswerError: " + error);
}


var HusterRTCEngine = function(wsURL) {
    this.init(wsURL);
    husterRTCEngine = this; 
    return this;
}

HusterRTCEngine.prototype.init = function(wsURL) {
    this.wsURL = wsURL;
    this.signaling = null;
}

HusterRTCEngine.prototype.createWebsocket = function() {
    husterRTCEngine = this;
    husterRTCEngine.signaling = new WebSocket(this.wsURL);

    husterRTCEngine.signaling.onopen = function() {
        // alert("WebSocket connected to signaling server");
        husterRTCEngine.onOpen();
    }
    
    husterRTCEngine.signaling.onmessage = function(event) {
        husterRTCEngine.onMessage(event);
    }

    husterRTCEngine.signaling.onerror = function(event) {
        husterRTCEngine.onError(event);
    }
    
    husterRTCEngine.signaling.onclose = function(event) {
        husterRTCEngine.onClose(event);
    }
}
HusterRTCEngine.prototype.onOpen = function() {
    console.log("WebSocket open");
}

HusterRTCEngine.prototype.onMessage = function(event) {
    console.log("WebSocket message"+event.data);

    var jsonMsg = JSON.parse(event.data);
    switch(jsonMsg.cmd) {
        case SIGNAL_TYPE_NEW_PEER:
            handleRemoteNewPeer(jsonMsg);
            break;
        case SIGNAL_TYPE_RESP_JOIN:
            handleResponseJoin(jsonMsg);
            break;
        case SIGNAL_TYPE_PEER_LEAVE:
            handleRemotePeerLeave(jsonMsg);
            break;
        case SIGNAL_TYPE_OFFER:
            handleRemoteOffer(jsonMsg);
            break;
        case SIGNAL_TYPE_ANSWER:
            handleRemoteAnswer(jsonMsg);
            break;
        case SIGNAL_TYPE_CANDIDATE:
            handleRemoteCandidate(jsonMsg);
            break;   
    }
}

HusterRTCEngine.prototype.onError = function(event) {
    console.log("WebSocket error"+event.data);
}

HusterRTCEngine.prototype.onClose = function(event) {
    console.log("WebSocket close -> code: " + event.code + ", reason: " + EventTarget.reason);
}

HusterRTCEngine.prototype.sendMessage = function(message) {
    this.signaling.send(message);
}

function handleResponseJoin(message) {
    console.info("handleResponseJoin, remoteUid: " + message.remoteUid);
    remoteUserId = message.remoteUid;
    // doOffer();
}

function handleRemotePeerLeave(message) {
    console.info("handleRemotePeerLeave, remoteUid: " + message.remoteUid);
    remoteVideo.srcObject = null;
    if(pc != null) {
        pc.close();
        pc = null;
    }
}

function handleRemoteNewPeer(message) {
    console.info("handleRemoteNewPeer, remoteUid: " + message.remoteUid);
    remoteUserId = message.remoteUid;
    doOffer();
}

function handleRemoteOffer(message) {
    console.info("handleRemoteOffer");
    if(pc == null) {
        createPeerConnection();
    }
    var desc = JSON.parse(message.msg);
    pc.setRemoteDescription(desc);
    doAnswer();
}

function handleRemoteAnswer(message) {
    console.info("handleRemoteAnswer");
    var desc = JSON.parse(message.msg);
    pc.setRemoteDescription(desc);
}

function handleRemoteCandidate(message) {
    console.info("handleRemoteCandidate");
    var candidate = JSON.parse(message.msg);
    pc.addIceCandidate(candidate).catch(e => {
        console.error("addIceCandidate failed:" + e.name);
    });
}

function doOffer() {
    // 创建RTCPeerConnection
    if (pc == null) {
        createPeerConnection();
    }
    pc.createOffer().then(createOfferAndSendMessage).catch(handleCreateOfferError);
}

function doAnswer() {
    pc.createAnswer().then(createAnswerAndSendMessage).catch(handleCreateAnswerError);
}


function doJion(roomId){
    var jsonMsg = {
        'cmd':'join',
        'roomId': roomId,
        'uid': localUserId,
    }
    var message = JSON.stringify(jsonMsg);
    husterRTCEngine.sendMessage(message);
    console.info("doJoin message: " + message);
}

function doLeave() {
    var jsonMsg = {
        'cmd': 'leave',
        'roomId': roomId,
        'uid': localUserId,
    };
    var message = JSON.stringify(jsonMsg);
    husterRTCEngine.sendMessage(message);
    console.info("doLeave message: " + message);
    hangup();
}

function hangup() {
    localVideo.srcObject = null; // 0.关闭自己的本地显示
    remoteVideo.srcObject = null; // 1.不显示对方
    closeLocalStream(); // 2. 关闭本地流
    if(pc != null) {
        pc.close(); // 3.关闭RTCPeerConnection
        pc = null;
    }
}

function closeLocalStream() {
    if(localStream != null) {
        localStream.getTracks().forEach((track) => {
                track.stop();
        });
    }
}

function openLocalStream(stream) {
    console.log("Open local stream");
    doJion(roomId);
    localVideo.srcObject = stream;
    localStream= stream;
}


function initLocalStream(){
    navigator.mediaDevices.getUserMedia({video: true, audio: true})
   .then(openLocalStream)
   .catch(function(err){
        alert('Failed to get user media' + err);
    });
}

husterRTCEngine = new HusterRTCEngine("wss://192.168.1.118:8098/ws")
husterRTCEngine.createWebsocket();


document.getElementById("joinBtn").onclick = function() {
    roomId = document.getElementById("roomId").value;
    if (roomId=="" || roomId=="输入房间ID"){
        alert("请先输入房间ID");
        return;  // 若没有输入房间ID，返回并不执行后面的代码
    }
    console.log("加入按钮被点击");
    initLocalStream();
}

document.getElementById('leaveBtn').onclick = function() {
    console.log("离开按钮被点击");
    doLeave();
}




