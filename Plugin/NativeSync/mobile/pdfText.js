'use strict';
// Minimal platform adapter for the existing FileOperator PDFParse/getText/
// destroy contract. No new parser or document execution is introduced.
async function extractPdfText(buffer){
 const {PDFParse}=require('pdf-parse');const parser=new PDFParse({data:buffer});
 try {const data=await parser.getText();if(Array.isArray(data.pages)&&!data.pages.some(page=>page.text?.trim()))throw Object.assign(Error(),{code:'ATTACHMENT_TEXT_UNAVAILABLE'});return data.text;}
 finally {await parser.destroy();}
}
module.exports={extractPdfText};
