import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, runtimeDependency, validateImage } from './lib/biblioteca.mjs';
import { canonical,buildTraitReferenceIndex } from '../web/catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const current=await read('data/current.json');
const catalog=await read(current.catalog);
const images=await read(current.images);
const verifiedArtwork=await read('data/overrides/verified-artwork.json').catch(error=>{
  if(error.code==='ENOENT')return {};
  throw error;
});
const records=Object.fromEntries(catalog.cards.map(c=>[c.code,c]));
const sharp=runtimeDependency('sharp');
const dist=path.join(root,'dist');
await fs.mkdir(path.join(dist,'assets'),{recursive:true});
const fields=['name','subname','text','back_text','back_name','traits','type_name','pack_name','faction_name','cost','deck_limit','quantity','type_code','faction_code','pack_code','hidden','resource_energy','resource_physical','resource_mental','resource_wild','attack','attack_cost','thwart','thwart_cost','defense','health','hand_size','is_unique'];
const pick=o=>Object.fromEntries(fields.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const cards=Object.fromEntries(catalog.cards.map(c=>[c.code,{code:c.code,role:c.role,en:pick(c.en),es:pick(c.es),links:c.links,coverage:c.translation_coverage,image:null,backImage:null,imageReference:null,printings:[]}]));
for(const [code,references]of Object.entries(buildTraitReferenceIndex(Object.values(cards))))Object.assign(cards[code],references);
const files=new Map();
async function queueArtwork(card,source,sha256){
  let rotation=0;
  if(card.en.type_code==='player_side_scheme'){
    const {width,height}=await sharp(path.join(root,source)).metadata();
    if(width>height)rotation=270;
  }
  const filename=sha256+(rotation?'-portrait':'')+'.webp';
  files.set(filename,{source,rotation});
  return 'assets/'+filename;
}
for(const image of images) {
  const ref=image.file?image:image.reference_image;
  if(!ref?.file) continue;
  const card=cards[image.code];
  card[image.face==='back'?'backImage':'image']=await queueArtwork(card,ref.file,ref.sha256);
  if(!image.file) card.imageReference=ref.code;
}
for(const [code,{sha256,source}] of Object.entries(verifiedArtwork)){
  const card=cards[code];
  if(card?.role!=='deck_card'||card.en.hidden||!/^[a-f0-9]{64}$/.test(sha256)
    ||!/^https:\/\/hallofheroeslcg\.com\/wp-content\/uploads\//.test(source)
    ||!source.endsWith('/'+code+'.jpg'))throw new Error('Ilustración verificada inválida: '+code);
  const file='data/images/sha256/'+sha256+'.jpg';
  const bytes=await fs.readFile(path.join(root,file));
  if(hash(bytes)!==sha256)throw new Error('Hash de ilustración no coincide: '+code);
  if((await validateImage(bytes)).extension!=='jpg')throw new Error('Formato de ilustración incorrecto: '+code);
  card.image=await queueArtwork(card,file,sha256);
  card.imageReference=null;
  card.artworkSource={source,sha256};
}
let done=0;
for(const [filename,{source,rotation}] of files) {
  const dest=path.join(dist,'assets',filename);
  try {await fs.access(dest);} catch {
    const image=sharp(path.join(root,source));
    if(rotation)image.rotate(rotation);
    await image.resize({width:800,height:1100,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toFile(dest);
  }
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
for(const file of ['index.html','styles.css','layout.css','theme-light.css','app.mjs','model.mjs','catalog.mjs','groups.mjs','artwork.mjs','icons.mjs','auxiliaries.mjs','construction.mjs','statistics.mjs','filter-presets.mjs','simulator.mjs','ally-filters.mjs','detail-navigation.mjs','card-presentation.mjs','collection-cycles.mjs']) await fs.copyFile(path.join(root,'web',file),path.join(dist,file));
console.log(`Gestor preparado en dist/: ${Object.keys(cards).length} registros, ${files.size} imágenes. Sin consultas de red.`);
