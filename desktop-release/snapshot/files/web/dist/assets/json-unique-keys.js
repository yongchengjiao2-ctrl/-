// Validate syntax first, then inspect object scopes before a parser can silently
// replace an earlier field. Identical keys in different objects remain valid.
export function parseUniqueKeys(text) {
 const raw=String(text), value=JSON.parse(raw), stack=[];
 const tokens=raw.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g)||[];
 for(const token of tokens){
  if(token==='{'){stack.push({object:true,keys:new Set(),expectKey:true});continue;}
  if(token==='['){stack.push({object:false});continue;}
  if(token==='}'||token===']'){stack.pop();continue;}
  const scope=stack.at(-1);
  if(!scope?.object)continue;
  if(token===','){scope.expectKey=true;continue;}
  if(token.startsWith('"')&&scope.expectKey){
   const key=JSON.parse(token);
   if(scope.keys.has(key))throw Error(`JSON存在重复字段：${key}，请保留唯一值后重新核对。`);
   scope.keys.add(key);scope.expectKey=false;
  }
 }
 return value;
}
