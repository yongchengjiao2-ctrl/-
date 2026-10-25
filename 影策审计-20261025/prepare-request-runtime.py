import pathlib
root=pathlib.Path(__file__).parent.parent/'character-prompt-formats'
p=root/'src/asset-extraction-runtime-v3.js';s=p.read_text('utf8')
if "from './text-request-policy.js'" not in s:s="import {textRequestPolicy} from './text-request-policy.js';\n"+s
start=s.index(' const channelId=model.includes(');end=s.index(' const knownIdentities=',start)
s=s[:start]+" const policy=textRequestPolicy(normalized);const config=policy.config;\n"+s[end:]
old="providerOptions:{[protocol]:{...model.includes('deepseek')?{thinking:{type:'disabled'}}:{},stream:false,response_format:{type:'json_object'},max_tokens:65536}}"
assert s.count(old)==1;s=s.replace(old,"providerOptions:policy.providerOptions,textRequestPolicy:policy.diagnostic")
old='assertSourceCoverage(data,e.variables);';assert s.count(old)==1;s=s.replace(old,'data.coverageAssessment=assertSourceCoverage(data,e.variables);')
old='assertSourceCoverage(data,metadata.promptTemplateVariables);';assert s.count(old)==1;s=s.replace(old,'data.coverageAssessment=assertSourceCoverage(data,metadata.promptTemplateVariables);')
# Keep the bounded validation retry but disclose and trace it explicitly.
old="validationAttempt:attempt,extractionContractVersion:4";assert s.count(old)==1
s=s.replace(old,"validationAttempt:attempt,maximumModelCalls:2,automaticValidationRetry:true,extractionSubmissionId:submissionId,extractionContractVersion:4")
old=" let failure='';";assert s.count(old)==1;s=s.replace(old," const submissionId=globalThis.crypto?.randomUUID?.()||`extract-${Date.now()}-${Math.random()}`;\n let failure='';")
old='  const result=await generate(';assert s.count(old)==1;s=s.replace(old,"  if(e.signal?.aborted)throw new DOMException('Aborted','AbortError');\n  const result=await generate(")
p.write_text(s,encoding='utf8');print('Prepared extraction request policy and coverage metadata')
