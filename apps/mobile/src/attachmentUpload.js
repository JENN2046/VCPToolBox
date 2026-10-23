const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
export async function uploadAttachment(api,topicKey,file,progress=()=>{}){
 if(file.size<1||file.size>20*1024*1024)throw Object.assign(Error('单个附件需在 20 MB 以内'),{code:'ATTACHMENT_FILE_TOO_LARGE'});
 const bytes=new Uint8Array(await file.arrayBuffer()),hash=hex(await crypto.subtle.digest('SHA-256',bytes));
 const requestId='file_'+hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([topicKey,file.name,file.size,hash]))));
 const route='conversations/'+encodeURIComponent(topicKey)+'/attachments';
 const input={requestId,name:file.name,size:bytes.length,expectedHash:hash,...(file.type?{type:file.type}:{})};
 let upload;try{upload=await api(route+'/uploads',input);}catch(e){if(e.code!=='UPLOAD_EXPIRED')throw e;upload=await api(route+'/uploads',{...input,requestId:requestId+'_'+Date.now()});}
 if(upload.state!=='ready')for(let offset=upload.offset;offset<bytes.length;){
  const chunk=bytes.subarray(offset,Math.min(bytes.length,offset+Math.min(upload.chunkSize,65536)));
  const result=await api(route+'/uploads/'+upload.uploadId+'/chunks',{offset,data:base64(chunk)});
  if(result.offset!==offset+chunk.length)throw Error('附件续传位置不一致，请重试');offset=result.offset;progress(Math.round(offset/bytes.length*100));
 }
 const complete=await api(route+'/uploads/'+upload.uploadId+'/finish',{});if(complete.hash!==hash)throw Error('附件完整性校验失败');progress(100);return complete.uploadId;
}
