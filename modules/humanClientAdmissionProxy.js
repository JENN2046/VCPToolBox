'use strict';
const http=require('node:http');
function forward(req, port) {
    return new Promise((resolve,reject)=>{
        if(!Number.isInteger(port)||port<1||port>65535||req.headers['x-human-client-forwarded'])return reject(Error('ADMISSION_DISABLED'));
        const suffix=req.path;
        if(!/^\/(?:enrollments\/[A-Za-z0-9_-]{43}(?:\/decision)?|sessions(?:\/[A-Za-z0-9_-]{43}\/revoke)?)$/.test(suffix))return reject(Error('INVALID_ENROLLMENT'));
        const body=req.method==='POST'?JSON.stringify(req.body):'';
        const headers={'x-human-client-forwarded':'1'};
        for(const k of ['authorization','cookie','origin'])if(req.headers[k])headers[k]=req.headers[k];
        if(body){headers['content-type']='application/json';headers['content-length']=Buffer.byteLength(body);}
        const r=http.request({hostname:'127.0.0.1',port,path:'/admin_api/human-client'+suffix,method:req.method,headers,timeout:5000},res=>{
            let size=0;const chunks=[];res.on('data',c=>{size+=c.length;if(size>524288){res.destroy();reject(Error('ADMISSION_DISABLED'));}else chunks.push(c);});
            res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks),type:res.headers['content-type']}));res.on('error',()=>reject(Error('ADMISSION_DISABLED')));
        });r.on('timeout',()=>r.destroy());r.on('error',()=>reject(Error('ADMISSION_DISABLED')));r.end(body);
    });
}
module.exports={forward};
