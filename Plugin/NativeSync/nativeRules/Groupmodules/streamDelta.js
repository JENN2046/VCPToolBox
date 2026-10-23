'use strict';
function groupStreamDelta(parsedChunk){let content='',hasContent=false;
// 标准OpenAI格式 (choices[0].delta.content)
                                        if (parsedChunk.choices && Array.isArray(parsedChunk.choices) && parsedChunk.choices.length > 0) {
                                            const choice = parsedChunk.choices[0];
                                            if (choice && choice.delta) {
                                                if (typeof choice.delta.content === 'string' && choice.delta.content !== '') {
                                                    content += choice.delta.content;
                                                    hasContent = true;
                                                }
                                            }
                                        }

                                        // 备选格式1 (delta.content)
                                        if (!hasContent && parsedChunk.delta) {
                                            if (typeof parsedChunk.delta.content === 'string' && parsedChunk.delta.content !== '') {
                                                content += parsedChunk.delta.content;
                                                hasContent = true;
                                            }
                                        }

                                        // 备选格式2 (content)
                                        if (!hasContent && typeof parsedChunk.content === 'string' && parsedChunk.content !== '') {
                                            content += parsedChunk.content;
                                            hasContent = true;
                                        }

                                        // 备选格式3 (message.content) - 某些API的格式
                                        if (!hasContent && parsedChunk.message && typeof parsedChunk.message.content === 'string' && parsedChunk.message.content !== '') {
                                            content += parsedChunk.message.content;
                                            hasContent = true;
                                        }

                                        
return content;}
module.exports={groupStreamDelta};
