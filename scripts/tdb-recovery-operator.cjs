#!/usr/bin/env node
'use strict';
// A local client only: never instantiate a manager/runtime and never fall back to standalone execution.
const {request}=require('../modules/tdbRecovery/operator-client');
const commands={'status':'STATUS','enable':'ENABLE_MANUAL','validate':'VALIDATE','submit':'SUBMIT','job-status':'JOB_STATUS','disable':'DISABLE_MANUAL'};
async function main(args){
    const command=args.shift();
    if(!Object.hasOwn(commands,command))throw Error('Usage: tdb-recovery-operator.cjs status|enable|validate|submit|job-status|disable [--library ID] [--reason ENUM] [--origin ID] [--ttl-seconds N] [--job-id UUID]');
    const input={operation:commands[command]};
    const flags={'--library':'library','--reason':'reason','--origin':'origin','--ttl-seconds':'ttl_seconds','--job-id':'job_id'};
    while(args.length){const flag=args.shift();if(!Object.hasOwn(flags,flag)||!args.length||Object.hasOwn(input,flags[flag]))throw Error('INVALID_OPERATOR_ARGUMENT');const value=args.shift();input[flags[flag]]=flag==='--ttl-seconds'?Number(value):value;}
    console.log(JSON.stringify(await request(input),null,2));
}
main(process.argv.slice(2)).catch(e=>{console.error(JSON.stringify({ok:false,error:e.code||'INVALID_OPERATOR_ARGUMENT'}));process.exitCode=1;});
