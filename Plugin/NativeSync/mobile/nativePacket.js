'use strict';
const {buildVcpChatExtensionsFromMessages,stripInternalMessageMetadata}=require('../nativeRules/modules/chat/requestEnvelope');
function nativePacket(messages,context,requestId,params){
 const projected=messages.map(m=>{const {__tavernInjected,...value}=m;return value;});
 const extensions=buildVcpChatExtensionsFromMessages(projected,context,requestId);
 return {...params,requestId,messages:stripInternalMessageMetadata(projected),...(extensions?{vcpchatExtensions:extensions}:{})};
}
module.exports={nativePacket};
