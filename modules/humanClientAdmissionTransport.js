'use strict';
const WebSocket=require('ws');
const {authority}=require('./approvalReceiptAuthority');
const {getAdmission}=require('./humanClientAdmissionRuntime');
const {WS_PATH,shape,LIMITS}=require('./humanClientAdmission');
const {dispatchApprovalMessage,broadcastApprovalTerminal}=require('./approvalProtocolTransport');
let wss;
function upgrade(request,socket,head,manager){
    let admission;try{admission=getAdmission();}catch{socket.destroy();return;}
    // The exact route carries capability only in a header, never in a URL/log.
    if(!admission||request.url!==WS_PATH||(wss?.clients.size||0)>=LIMITS.sessions*LIMITS.sockets){socket.destroy();return;}
    let claim;try{claim=authority.claimClientChannel(request.headers['x-vcp-human-capability']);}catch{socket.destroy();return;}
    if(!wss)wss=new WebSocket.Server({noServer:true,maxPayload:8192,perMessageDeflate:false});
    wss.handleUpgrade(request,socket,head,ws=>{
        let proof;try{proof=admission.beginChannel(ws,claim);}catch{ws.terminate();return;}
        ws.send(JSON.stringify({type:'human_channel_challenge',data:proof}));
        let pending=true;
        ws.on('error',()=>{});
        ws.on('message',bytes=>{
            try{
                const msg=JSON.parse(bytes.toString());
                if(pending){shape(msg,['type','data']);if(msg.type!=='human_channel_proof')throw Error();admission.completeChannel(ws,msg.data);pending=false;ws.send(JSON.stringify({type:'human_channel_ready',data:{protocolVersion:1,clientSurface:'vcp_chat'}}));return;}
                if(!authority.isHuman(ws))throw Error();
                if(msg.type==='tool_approval_response'||msg.type==='tool_approval_sync')dispatchApprovalMessage(ws,msg,manager);
                else throw Error();
            }catch{ws.close(1008,'CLIENT_NOT_AUTHORIZED');}
        });
    });
}
function broadcast(data){if(data?.type==='tool_approval_request')for(const ws of wss?.clients||[])if(authority.isHuman(ws)&&ws.readyState===WebSocket.OPEN)try{ws.send(JSON.stringify(data));}catch{}}
function terminal(data){broadcastApprovalTerminal(wss?.clients||[],authority,data);}
function shutdown(){if(wss){for(const ws of wss.clients)ws.terminate();wss.close();wss=null;}}
module.exports={upgrade,broadcast,terminal,shutdown};
