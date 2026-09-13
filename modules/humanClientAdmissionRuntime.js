'use strict';
const { authority } = require('./approvalReceiptAuthority');
const { HumanClientAdmission } = require('./humanClientAdmission');
const {TrustedClientAuthorityStore}=require('./trustedClientAuthorityStore');
let admission;
function getAdmission() {
    if(admission)return admission;
    // Explicit external origins only. Request Host/forwarded headers are never authority.
    const host=process.env.HUMAN_CLIENT_HOST_ORIGIN, admin=process.env.HUMAN_CLIENT_ADMIN_ORIGIN;
    if(!host||!admin)return null;
    try{const store=new TrustedClientAuthorityStore({registryRoot:process.env.TRUSTED_CLIENT_AUTHORITY_ROOT,anchorRoot:process.env.TRUSTED_CLIENT_ANCHOR_ROOT});admission=new HumanClientAdmission({authority,store,trustedHostOrigin:host,trustedAdminOrigin:admin});return admission;}catch{throw Object.assign(new Error('TRUSTED_CLIENT_RECOVERY_LOCKDOWN'),{code:'TRUSTED_CLIENT_RECOVERY_LOCKDOWN'});}
}
module.exports={getAdmission};
