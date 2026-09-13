'use strict';
// Host-owned catalog, no request/env profile promotion or activation endpoint.
const PROFILES=Object.freeze({
    'vcp_chat.c1.fixture':Object.freeze({id:'vcp_chat.c1.fixture',activation:'TEST_ONLY'}),
    'vcp_chat.c2':Object.freeze({id:'vcp_chat.c2',activation:'PRODUCTION_DISABLED'})
});
function profile(store){return store.testOnly?PROFILES['vcp_chat.c1.fixture']:PROFILES['vcp_chat.c2'];}
function productionAdmitted(record){
    // C2 reviewed native boundary + separate admission authorization is not present in C1-A1.
    // No catalog entry can be promoted by payload, environment or persisted profile spelling.
    return PROFILES[record?.implementationProfileId]?.activation==='PRODUCTION_ADMITTED';
}
module.exports={PROFILES,profile,productionAdmitted};
