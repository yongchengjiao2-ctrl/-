// Offline, one-time migration. Does not contain credentials or personal projects.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync, backup} from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const versionRoot = path.resolve(here, '../..');
const args = process.argv.slice(2);
const trace = message => {if (args.includes('--verbose')) console.error(message);};
const rootArg = args.indexOf('--install-root');
if (rootArg < 0 || !args[rootArg + 1]) throw Error('--install-root is required');
const installRoot = path.resolve(args[rootArg + 1]);
const dataRoot = path.join(installRoot, 'data');
const snapshot = JSON.parse(fs.readFileSync(path.join(here, 'desktop-snapshot.json'), 'utf8'));
const stateText = fs.readFileSync(path.join(here, 'database-state.json'), 'utf8');
const promptsText = fs.readFileSync(path.join(here, 'prompt-templates.json'), 'utf8');
const registryText = fs.readFileSync(path.join(here, 'plugin-registry.json'), 'utf8');
const stateHash = crypto.createHash('sha256').update(stateText).update(promptsText).update(registryText).digest('hex');
const receiptPath = path.join(dataRoot, `desktop-state-${snapshot.releaseVersion}.json`);
if (!args.includes('--force') && fs.existsSync(receiptPath) && JSON.parse(fs.readFileSync(receiptPath, 'utf8')).stateHash === stateHash) {
  console.log('Desktop state already applied; later user edits preserved.');
  process.exit(0);
}
fs.mkdirSync(dataRoot, {recursive:true});
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const backupRoot = path.join(dataRoot, 'backups', `desktop-state-${snapshot.releaseVersion}-${stamp}`);
fs.mkdirSync(backupRoot, {recursive:true});
const dbPath = path.join(dataRoot, 'open_ai_canvas.db');
const existed = fs.existsSync(dbPath);
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout=15000; PRAGMA foreign_keys=OFF;');
if (existed) await backup(db, path.join(backupRoot, 'database.db'));
const state = JSON.parse(stateText);
const prompts = JSON.parse(promptsText);
const registry = JSON.parse(registryText);
const quote = name => '"' + name.replaceAll('"','""') + '"';
function put(table,row) {
  const names = Object.keys(row);
  db.prepare(`INSERT OR REPLACE INTO ${quote(table)} (${names.map(quote).join(',')}) VALUES (${names.map(()=>'?').join(',')})`).run(...names.map(n=>row[n]));
}
const registryPath = path.join(dataRoot, 'plugin_registry.json');
const oldRegistry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath,'utf8').replace(/^\uFEFF/,'')) : [];
if (fs.existsSync(registryPath)) fs.copyFileSync(registryPath,path.join(backupRoot,'plugin_registry.json'));
for (const entry of registry) {
  if (!entry.packagePath) continue;
  if (path.basename(entry.packagePath) !== entry.packagePath) throw Error('Invalid plugin path');
  const src = path.join(here,'plugin-packages',entry.packagePath);
  if (crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex') !== entry.packageSha256) throw Error(`Plugin checksum failed: ${entry.id}`);
  fs.mkdirSync(path.join(dataRoot,'plugin-packages'),{recursive:true});
  fs.copyFileSync(src,path.join(dataRoot,'plugin-packages',entry.packagePath));
}
function copyTree(source,target) {
  fs.mkdirSync(target,{recursive:true});
  for (const entry of fs.readdirSync(source,{withFileTypes:true})) {
    const src=path.join(source,entry.name), dst=path.join(target,entry.name);
    if(entry.isDirectory()) copyTree(src,dst);
    else if(entry.isFile()) fs.copyFileSync(src,dst);
    else throw Error('Unexpected skill package link: '+entry.name);
  }
}
trace('Copy builtin skill files');
if (fs.existsSync(path.join(here,'skill-packages'))) copyTree(path.join(here,'skill-packages'),path.join(dataRoot,'skill-packages'));
trace('Initialize schema');
try {
  db.exec('BEGIN IMMEDIATE');
  for (const item of state.schema) {
    trace('Schema '+item.name);
    const exists = db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(item.name);
    if (!exists) db.exec(item.sql);
  }
  trace('Restore builtin skill metadata');
  for (const [table, rows] of Object.entries(state.tables)) for (const row of rows) put(table,row);
  // Keep previous template versions for recovery, enable the exact desktop content.
  for (const template of prompts) {
    db.prepare('UPDATE prompt_templates SET enabled=0 WHERE operation=?').run(template.operation);
    put('prompt_templates',{...template,created_by:''});
  }
  // Fresh desktop mode creates this same local account on first backend startup.
  const users = db.prepare("SELECT id FROM users WHERE status='active'").all();
  for (const user of users) for (const selected of state.selectedSkills) {
    const old = db.prepare('SELECT id FROM user_skill_states WHERE user_id=? AND skill_id=?').get(user.id,selected.skill_id);
    put('user_skill_states',{id:old?.id||crypto.randomUUID(),user_id:user.id,library_category_id:'',...selected,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  }
  if (!users.length && state.selectedSkills.length) {
    // A fresh backend creates its random local admin ID on first startup.
    // Seed that account's library as part of the same INSERT transaction.
    const literal = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : "'"+String(value).replaceAll("'","''")+"'";
    const statements = state.selectedSkills.map(selected => {
      const row={id:null,user_id:null,library_category_id:'',...selected,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      const names=Object.keys(row);
      const values=names.map(name=>name==='id'?"lower(hex(randomblob(16)))":name==='user_id'?'NEW.id':literal(row[name]));
      return `INSERT OR IGNORE INTO user_skill_states (${names.map(quote).join(',')}) VALUES (${values.join(',')});`;
    });
    db.exec(`CREATE TRIGGER IF NOT EXISTS yingce_desktop_state_default_skills AFTER INSERT ON users WHEN NEW.status='active' BEGIN ${statements.join(' ')} END`);
  }
  for (const template of prompts) {
    const actual = db.prepare('SELECT content FROM prompt_templates WHERE id=? AND enabled=?').get(template.id,template.enabled);
    if (actual?.content !== template.content) throw Error('Prompt migration comparison failed: '+template.operation);
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
const nextRegistry = [...oldRegistry.filter(old=>!registry.some(item=>item.id===old.id)),...registry];
fs.writeFileSync(registryPath+'.new',JSON.stringify(nextRegistry,null,2)+'\n');
fs.renameSync(registryPath+'.new',registryPath);
// Upgrade the updater used by old installations; future releases can migrate
// templates before switching versions as well as through the bootstrap fallback.
const installer = path.join(versionRoot,'install.ps1');
if (fs.existsSync(installer)) {
  const target = path.join(installRoot,'install.ps1');
  if (fs.existsSync(target)) fs.copyFileSync(target,path.join(backupRoot,'install.ps1'));
  fs.copyFileSync(installer,target);
}
const receipt = {version:snapshot.releaseVersion,stateHash,prompts:prompts.length,
  skills:state.tables.skills.length,plugins:registry.length,appliedAt:new Date().toISOString(),
  backup:backupRoot,personalProjectsAndChannels:'preserved'};
fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
