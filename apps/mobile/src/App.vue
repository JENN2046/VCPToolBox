<script setup>
import {ref,onMounted,onUnmounted,nextTick} from 'vue';
const paired=ref(false),pairCode=ref(''),topics=ref([]),selected=ref(''),messages=ref([]),jobs=ref([]),text=ref(''),busy=ref(false),notice=ref('正在连接…'),online=ref(true),history=ref(null);
let timer,lastSubmission=null,refreshing=false;
const labels={preparing:'正在持久保存',queued:'已接受 · 等待执行',running:'服务端执行中',cancelling:'正在取消',cancelled:'已取消',publishing:'正在保存回复',completed:'回复已保存',failed:'执行失败'};
async function api(route,body){
 const r=await fetch('/mobile/api/'+route,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const result=await r.json();if(!r.ok){if(r.status===401)paired.value=false;throw Error(result.error?.code||'连接失败');}return result;
}
async function session(){try{const r=await api('session');paired.value=true;topics.value=r.topics;if(!selected.value)selected.value=r.topics[0]?.key||'';await refresh();}catch(e){notice.value=e.message==='PAIR_REQUIRED'?'使用一次性配对码连接测试会话':e.message;}}
async function pair(){busy.value=true;try{await api('pair',{code:pairCode.value});pairCode.value='';await session();}catch{notice.value='配对失败或已过期，请重新获取配对码';}finally{busy.value=false;}}
async function refresh(){
 if(!paired.value||!selected.value||refreshing)return;refreshing=true;const key=selected.value;
 try{let after=0,all=new Map(),result;do{result=await api('conversations/'+encodeURIComponent(key)+'?after='+after);for(const row of result.messages){if(!row.deleted)all.set(row.id,row.message);}after=result.next;}while(result.hasMore);
  if(selected.value!==key)return;messages.value=[...all.values()].sort((a,b)=>a.timestamp-b.timestamp);jobs.value=result.executions;online.value=true;
  if(!busy.value)notice.value='会话已同步';await nextTick();if(history.value)history.value.scrollTop=history.value.scrollHeight;
 }catch{online.value=false;notice.value='连接中断，重新连接后恢复状态';}finally{refreshing=false;}
}
async function submit(submission){
 busy.value=true;notice.value='正在提交…';lastSubmission=submission;
 try{const accepted=await api('conversations/'+encodeURIComponent(selected.value)+'/messages',submission);notice.value='已持久接受 · '+(labels[accepted.state]||accepted.state);text.value='';await refresh();}
 catch(e){notice.value='尚未确认接受，可重试同一次提交：'+e.message;}finally{busy.value=false;}
}
function send(){if(!text.value.trim()||busy.value)return;submit({requestId:crypto.randomUUID(),text:text.value});}
function retry(){
 const latest=[...jobs.value].reverse().find(j=>j.own&&j.state!=='cancelled');
 const original=latest&&messages.value.find(m=>m.id===latest.userMessageId);
 const submission=lastSubmission||(original?{requestId:latest.requestId,text:original.content}:null);
 if(submission&&!busy.value)submit(submission);
}
async function cancel(id){try{await api('executions/'+id+'/cancel',{});await refresh();}catch(e){notice.value=e.message;}}
onMounted(async()=>{await session();timer=setInterval(refresh,450);});onUnmounted(()=>clearInterval(timer));
</script>
<template>
 <div class="shell">
  <header><img :src="'/mobile/icon.svg'" alt=""><div><strong>VCP Mobile</strong><small>同一段会话，随时接续</small></div><span class="connection" :class="{offline:!online}">{{online?'已连接':'离线'}}</span></header>
  <main v-if="!paired" class="pairing"><div class="intro">连接你的会话</div><p>输入由服务端签发的一次性配对码。此页面无需 ToolBox API Key。</p><form @submit.prevent="pair"><label for="pair-code">一次性配对码</label><input id="pair-code" v-model="pairCode" type="password" autocomplete="off" required><button id="pair-submit" :disabled="busy">连接会话</button></form><p role="status">{{notice}}</p></main>
  <template v-else>
   <nav><label for="topic-select">Agent / 话题</label><select id="topic-select" v-model="selected" @change="lastSubmission=null;refresh()"><option v-for="t in topics" :key="t.key" :value="t.key">{{t.agentName}} · {{t.topicName}}</option></select></nav>
   <section ref="history" id="history" aria-label="聊天历史"><div class="start">文本会话 · 服务端持久保存</div><article v-for="m in messages" :key="m.id" class="message" :class="m.role" :data-message-id="m.id"><small>{{m.role==='user'?'你':(m.name||topics.find(t=>t.key===selected)?.agentName||'Agent')}}</small><div class="bubble">{{m.content}}</div></article><p v-if="!messages.length" class="empty">还没有消息，发送一条开始会话。</p></section>
   <section class="executions" aria-label="执行状态"><div v-for="j in jobs" :key="j.id" class="execution-row" :data-exec-id="j.id" :data-state="j.state"><span>{{labels[j.state]||j.state}}</span><button v-if="j.own&&['queued','running'].includes(j.state)" :data-cancel-id="j.id" @click="cancel(j.id)">取消</button></div></section>
   <footer><form @submit.prevent="send"><label class="sr-only" for="message-text">消息</label><textarea id="message-text" v-model="text" placeholder="输入文字…" rows="2" maxlength="12000"></textarea><button id="send" :disabled="busy||!text.trim()">发送</button></form><div class="send-state"><span id="send-state" role="status">{{notice}}</span><button id="retry-last" @click="retry" :disabled="busy">重试提交</button></div></footer>
  </template>
 </div>
</template>
