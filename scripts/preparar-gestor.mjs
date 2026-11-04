import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeDependency } from './lib/biblioteca.mjs';
import { canonical,buildTraitReferenceIndex } from '../web/catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const current=await read('data/current.json');
const catalog=await read(current.catalog);
const images=await read(current.images);
const records=Object.fromEntries(catalog.cards.map(c=>[c.code,c]));
const sharp=runtimeDependency('sharp');
const dist=path.join(root,'dist');
await fs.mkdir(path.join(dist,'assets'),{recursive:true});
const fields=['name','subname','text','back_text','back_name','traits','type_name','pack_name','faction_name','cost','deck_limit','quantity','type_code','faction_code','pack_code','hidden','resource_energy','resource_physical','resource_mental','resource_wild','attack','attack_cost','thwart','thwart_cost','defense','health','hand_size','is_unique'];
const pick=o=>Object.fromEntries(fields.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const cards=Object.fromEntries(catalog.cards.map(c=>[c.code,{code:c.code,role:c.role,en:pick(c.en),es:pick(c.es),links:c.links,coverage:c.translation_coverage,image:null,backImage:null,imageReference:null,printings:[]}]));
for(const [code,references]of Object.entries(buildTraitReferenceIndex(Object.values(cards))))Object.assign(cards[code],references);
const files=new Map();
for(const image of images) {
  const ref=image.file?image:image.reference_image;
  if(!ref?.file) continue;
  const filename=ref.sha256+'.webp';files.set(ref.file,filename);
  cards[image.code][image.face==='back'?'backImage':'image']='assets/'+filename;
  if(!image.file) cards[image.code].imageReference=ref.code;
}
let done=0;
for(const [source,filename] of files) {
  const dest=path.join(dist,'assets',filename);
  try {await fs.access(dest);} catch {await sharp(path.join(root,source)).resize({width:800,height:1100,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toFile(dest);}
  if(++done%400===0) console.log('Imágenes preparadas:',done);
}
const packs={};
for(const c of Object.values(cards)) {
  packs[c.en.pack_code]??={code:c.en.pack_code,name:c.es.pack_name||c.en.pack_name};
  if(c.role==='deck_card' && !c.en.hidden) {
    const code=canonical(c,cards);
    cards[code].printings.push({code:c.code,pack:c.en.pack_code,quantity:c.en.quantity||0});
  }
}
await fs.writeFile(path.join(dist,'catalog.json'),JSON.stringify({revision:current.revision,cards,packs:Object.values(packs).sort((a,b)=>a.name.localeCompare(b.name,'es'))}));
for(const file of ['index.html','styles.css','app.mjs','model.mjs','catalog.mjs','groups.mjs','artwork.mjs','icons.mjs','auxiliaries.mjs','construction.mjs','statistics.mjs','filter-presets.mjs','simulator.mjs','ally-filters.mjs','detail-navigation.mjs','card-presentation.mjs']) await fs.copyFile(path.join(root,'web',file),path.join(dist,file));
console.log(`Gestor preparado en dist/: ${Object.keys(cards).length} registros, ${files.size} imágenes. Sin consultas de red.`);
