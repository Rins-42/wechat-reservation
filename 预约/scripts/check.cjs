const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname,'..');
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => ['node_modules','miniprogram_npm','.git'].includes(e.name) ? [] : e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
function loadPage(file, wx = {}, app = {}) {
  let page;
  const absolute=path.resolve(root,file);
  vm.runInNewContext(fs.readFileSync(absolute,'utf8'),{Page:p=>{page=p;},getApp:()=>app,wx:{canIUse:()=>true,...wx},require:createRequire(absolute),console:{log(){},error(){}},setTimeout});
  return page;
}
function check() {
  const errors=[];const files=walk(root);
  for(const file of files) {
    try {
      const source=fs.readFileSync(file,'utf8');
      if(file.endsWith('.js')||file.endsWith('.cjs')) new vm.Script(source,{filename:file});
      if(file.endsWith('.json')) JSON.parse(source);
    } catch(error) { errors.push(error.message); }
  }
  const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'));
  const cloudCalls=new Set();
  for(const route of app.pages) {
    for(const ext of ['js','json','wxml','wxss']) if(!fs.existsSync(path.join(root,route+'.'+ext))) errors.push('Missing '+route+'.'+ext);
    const page=loadPage(route+'.js');
    const template=fs.readFileSync(path.join(root,route+'.wxml'),'utf8');
    for(const m of template.matchAll(/(?:bind|catch):?[\w-]*\s*=\s*"([A-Za-z_$][\w$]*)"/g)) if(typeof page[m[1]]!=='function') errors.push(route+': missing handler '+m[1]);
    for(const m of template.matchAll(/(?:src|import)="(\/[^{}"]+)"/g)) if(!fs.existsSync(path.join(root,m[1]))) errors.push('Missing asset '+m[1]);
    for(const m of template.matchAll(/\{\{([^}]+)\}\}/g)) if(/[\w.]\s*\(/.test(m[1])) errors.push(route+': function call in WXML '+m[1]);
  }
  for(const file of files.filter(f=>f.endsWith('.js')&&!f.includes(path.sep+'cloudfunctions'+path.sep))) {
    const source=fs.readFileSync(file,'utf8');
    for(const m of source.matchAll(/callFunction\s*\(\s*\{\s*name:\s*['"]([^'"]+)/g)) cloudCalls.add(m[1]);
    if(source.includes('"{openid}"')) errors.push('Unresolved identity placeholder in '+file);
  }
  for(const name of cloudCalls) if(!fs.existsSync(path.join(root,'cloudfunctions',name,'index.js'))) errors.push('Missing cloud function '+name);
  if(errors.length) throw new Error(errors.join('\n'));
  return {files:files.length,pages:app.pages.length,cloudFunctions:cloudCalls.size};
}
module.exports={loadPage,check,root};
if(require.main===module) console.log('Project checks passed:',check());
