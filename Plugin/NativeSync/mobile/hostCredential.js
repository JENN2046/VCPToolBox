'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');

// The user enters the existing ToolBox Key through HTTPS once. Validate it only
// over this machine's loopback, then encrypt it in the existing central SQLite.
// Neither production config.env nor provider credentials are read or copied.
class HostCredential {
    constructor({dataDir,backend='http://127.0.0.1:6005'}) {
        const url=new URL(backend);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw Error('LOCAL_TOOLBOX_AUTHORITY_REQUIRED');
        this.backend=url.origin;this.key=null;
        const file=path.join(dataDir,'host-credential.master');
        try{fs.writeFileSync(file,crypto.randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
        const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||(stat.mode&0o077))throw Error('HOST_CREDENTIAL_PERMISSIONS');
        this.master=fs.readFileSync(file);if(this.master.length!==32)throw Error('HOST_CREDENTIAL_MASTER_INVALID');
        this.db=new DatabaseSync(path.join(dataDir,'central.sqlite'));this.db.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS mobile_host_credential(id INTEGER PRIMARY KEY CHECK(id=1),iv BLOB NOT NULL,tag BLOB NOT NULL,cipher BLOB NOT NULL)');
        const row=this.db.prepare('SELECT iv,tag,cipher FROM mobile_host_credential WHERE id=1').get();
        if(row){const decipher=crypto.createDecipheriv('aes-256-gcm',this.master,row.iv);decipher.setAuthTag(row.tag);this.key=Buffer.concat([decipher.update(row.cipher),decipher.final()]).toString('utf8');}
    }
    matches(value){if(!this.key||typeof value!=='string')return false;const sha=x=>crypto.createHash('sha256').update(x).digest();return crypto.timingSafeEqual(sha(value),sha(this.key));}
    async verifyAndRemember(key){
        if(typeof key!=='string'||!key||key.length>8192)return false;
        let response;try{response=await fetch(this.backend+'/v1/models',{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(8000)});}catch{return false;}
        const valid=response.status===200;await response.body?.cancel();if(!valid)return false;
        const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',this.master,iv);const bytes=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);
        this.db.prepare('INSERT INTO mobile_host_credential(id,iv,tag,cipher) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET iv=excluded.iv,tag=excluded.tag,cipher=excluded.cipher').run(iv,cipher.getAuthTag(),bytes);this.key=key;return true;
    }
    close(){this.key=null;this.master.fill(0);this.db.close();}
}
module.exports={HostCredential};
