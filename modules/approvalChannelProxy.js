'use strict';
const http=require('node:http');
// The independent Admin process has no receipt registry. Forward only this one
// authenticated endpoint to the loopback main service, never an arbitrary URL.
function forwardApprovalChannel(req,port){
    if(!Number.isInteger(port)||port<1||port>65535)return Promise.reject(Error('Approval issuer unavailable'));
    const headers={'x-vcp-approval-forwarded':'1'};
    for(const key of ['authorization','cookie','host','x-forwarded-host','x-forwarded-proto'])if(typeof req.headers[key]==='string')headers[key]=req.headers[key];
    return new Promise((resolve,reject)=>{
        const request=http.get({hostname:'127.0.0.1',port,path:'/admin_api/notifications/connection',headers,timeout:5000},response=>{
            const chunks=[];let size=0;
            response.on('data',b=>{size+=b.length;if(size>8192)request.destroy(Error('Approval issuer response exceeds bound'));else chunks.push(b);});
            response.on('error',()=>reject(Error('Approval issuer unavailable')));
            response.on('end',()=>{try{const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));resolve({status:response.statusCode,body});}catch{reject(Error('Approval issuer unavailable'));}});
        });
        request.on('timeout',()=>request.destroy(Error('Approval issuer timeout')));
        request.on('error',()=>reject(Error('Approval issuer unavailable')));
    });
}
module.exports={forwardApprovalChannel};
