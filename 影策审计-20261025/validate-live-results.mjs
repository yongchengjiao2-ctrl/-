import fs from 'node:fs';import path from 'node:path';
const base=path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets');
const parserSource=fs.readFileSync(path.join(base,'canvas-character-reference-qPZJkX1a.js'),'utf8');
const actualParser=new Function(parserSource.slice(parserSource.indexOf('function s(e)'),parserSource.indexOf('var p=e('))+';return f')();
for(const id of ['four-panel','side-portrait']){
 const p=new URL('./synthetic-'+id+'.assets.json',import.meta.url);const assets=JSON.parse(fs.readFileSync(p,'utf8'));const reportURL=new URL('./synthetic-'+id+'.report.json',import.meta.url);const report=JSON.parse(fs.readFileSync(reportURL,'utf8'));
 try{
 for(const character of assets.characters){if(!Array.isArray(character.aliases)||!character.aliases.every(x=>typeof x==='string'))throw Error('invalid aliases');for(const field of ['name','role','appearance','physique','clothing','personality','props','consistencyPrompt','multiViewPrompt','voiceLanguage','voiceAge','voiceTimbre'])if(typeof character[field]!=='string')throw Error('invalid '+field);}
 for(const key of ['scenes','props'])for(const item of assets[key])for(const field of ['name','description','prompt'])if(typeof item[field]!=='string'||!item[field].trim())throw Error('invalid '+key+'.'+field);
 const parsed=actualParser(JSON.stringify(assets));if(parsed.length!==assets.characters.length)throw Error('parser dropped characters');
 report.characterFieldTypesPassed=true;report.installedCharacterParserPassed=true;report.installedCharacterParserCount=parsed.length;
 }catch(e){report.extraValidationError=e.message;}
 fs.writeFileSync(reportURL,JSON.stringify(report,null,2));console.log(id,report.installedCharacterParserPassed,report.extraValidationError||'');
}
