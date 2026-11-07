import {createDeck,DeckStore,addVersion,nextVersionNumber,diffCards,validateImport} from './model.mjs';
import {factions,types,resources,title,plain,normalize,cardTraits,scopedTraits,TEXT_TOPICS,traitCounts,specialRuleFor,allowedFactions,automaticName,baseAspectCodes,requiredAspectCount,heroSetTraits,canonical,limit,deckLimit,filterCards,shortage,requiredHeroCards,ensureHeroCards,canSetQuantity,selectionState,toggleSelection,filterDecks,CARD_SORT_DEFAULTS,paginateCards} from './catalog.mjs';
import {initializeGroups,addCustomGroup,defaultGroup,listDeckGroups,moveToGroup,hideGroup,restoreGroup,deleteCustomGroup,clearCustomGroup} from './groups.mjs';
import {artworkOptions,selectedArtwork,galleryArtworks} from './artwork.mjs';
import {iconSvg} from './icons.mjs';
import {AUXILIARY_GROUP,auxiliaryCards,automaticAuxiliaries,startsInAuxiliaries} from './auxiliaries.mjs';
import {constructionReport,removeConstructionCards} from './construction.mjs';
import {deckStatistics} from './statistics.mjs';
import {FilterPresetStore,createPreset,presetCriteria,presetMatches,presetResults,singleVisiblePreset,isPresetStorageKey} from './filter-presets.mjs';
import {DrawSimulator,printedHandSizes} from './simulator.mjs';
import {ALLY_STATS,allyStatOptions,normalizeAllyFilter,setAllyStatValues} from './ally-filters.mjs';
import {DetailNavigation} from './detail-navigation.mjs';
import {ruleTextParts,identityPreviewCards} from './card-presentation.mjs';
import {collectionCycles} from './collection-cycles.mjs';
const $=id=>document.getElementById(id);
const themePreference=$('theme-preference');
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
const desktopDetail=matchMedia('(min-width: 851px)');
function applyTheme(){
  document.documentElement.dataset.theme=themePreference.value==='system'
    ? (systemTheme.matches?'dark':'light') : themePreference.value;
}
try {
  const saved=localStorage.getItem('marvel.ux.theme');
  if(['light','dark','system'].includes(saved))themePreference.value=saved;
}catch{}
applyTheme();
themePreference.onchange=()=>{
  applyTheme();
  try{localStorage.setItem('marvel.ux.theme',themePreference.value);}catch{}
};
systemTheme.addEventListener('change',applyTheme);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,action,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=action;return b;};
const option=(value,label)=>{const o=el('option',label);o.value=value;return o;};
const clone=x=>JSON.parse(JSON.stringify(x));
let catalog,cards,choices,store,deck,revision=null,dirty=false,page=1,saving=false;
let pendingAspects=null, editingId=null;
const heroOptions=new Map(), heroTraitsByCode=new Map();
let showHeroDisplay=true, showAlterEgo=false, centeredHeroForm=null;
let wheelDistance=0,lastWheelTime=-Infinity,wheelDirection=0,heroWheelPaused=false;
let heroLanguage=localStorage.getItem('marvel.ux.hero-language')==='en'?'en':'es';
const pageId=crypto.randomUUID();
let collection={};
let selectedTraits=[],allTraits=[],playerTraits=[],costOptions=[];
let readOnly=false,armedOnly=false,retainedArmed=new Set(),librarySort={sortKey:'',direction:0};
let galleryWidth=180,deckColumns=2;
let rowLimit=3,selectedFirst=false,galleryColumns=1,draggingCard='',pendingGroupDelete=null;
let traitSort='name',deckTraitSort='name',traitListView='deck',availableRecords=[];
let cleanupUndo=null;
let filterStore,presets=[],activePresetId='',advancedFilters=false,presetsReady=false,applyingPreset=false,filterWrites=0,presetRefreshPending=false,pinConfirmation=null;
let simulation=null,simulationKey='',simulationNotice='';
let allyFilter=normalizeAllyFilter(),allyOptions={};
const SEARCH_DELAY_MS=500;
let searchTimer=null,traitSuggestionsOpen=false;
let detailNavigation=null,detailCode='',detailBack=false,galleryDetailCodes=[];
const single={faction:false,type:false,cost:false,resource:false},lastChoice={};
const selection={faction:new Set(Object.keys(factions)),type:new Set(Object.keys(types)),cost:new Set(),resource:new Set(Object.keys(resources))};
function status(message){$('status').textContent=message;}
const report=e=>{console.error(e);status(e.message||String(e));};
function drafts(){
  const result=[];for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(key.startsWith('marvel.draft.'))try{const d=JSON.parse(sessionStorage.getItem(key));if(d?.deck?.id)result.push(d);}catch{}}
  return result;
}
function popup(titleText,body,isCard=false) {if(!isCard){detailNavigation=null;detailCode='';closePinPopover();}$('detail-tools').hidden=!isCard;$('detail-copies').replaceChildren();$('modal-title').textContent=titleText;$('modal-title').title=titleText;$('modal-body').replaceChildren(body);if(!$('modal').open)$('modal').showModal();}
function placeDetailCopies(bar=$('modal').querySelector('.detail-copy-bar')){
  if(!bar)return;
  if(desktopDetail.matches)$('detail-copies').append(bar);
  else $('modal-body').prepend(bar);
}
desktopDetail.addEventListener('change',()=>placeDetailCopies());
function download(name,content,mime='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function saveDraft() {
  try {const value=JSON.stringify({deck,revision,dirty,updated:new Date().toISOString()});sessionStorage.setItem('marvel.draft.'+deck.id,value);sessionStorage.setItem('marvel.last',deck.id);localStorage.setItem('marvel.recovery.'+deck.id+'.'+pageId,value);return true;}
  catch(e){status('No se pudo conservar el borrador: exporta el mazo antes de cerrar.');return false;}
}
function renderSaveChanges(){
  const control=$('save-changes');
  control.hidden=!dirty||readOnly||$('constructor-view').hidden;
  control.disabled=saving;
}
function changed(refresh=true) {if(readOnly)return;dirty=true;saveDraft();status('Borrador con cambios · Guarda una versión para incorporarlos a la biblioteca.');if(refresh)render();else renderSaveChanges();}
function showView(name,reading=false){
  // The loaded record remains a read-only snapshot while browsing the library.
  // Do not turn it into an editable draft just because its section is hidden.
  if(name==='constructor')readOnly=reading;
  document.body.classList.toggle('readonly',name==='constructor'&&readOnly);
  $('constructor-view').hidden=name!=='constructor';$('library-view').hidden=name!=='library';$('readonly-actions').hidden=!readOnly;
  renderSaveChanges();
  $('constructor-button').setAttribute('aria-pressed',String(name==='constructor'&&!reading));$('library-button').setAttribute('aria-pressed',String(name==='library'||reading));
  if(name==='library'){renderLibrary();status('Biblioteca local · Mazos guardados en este navegador');}
}
function editCurrent(){
  if(!editingId){openNewDeck();return;}
  if(!readOnly&&deck.id===editingId){showView('constructor');if(!deck.hero)openNewDeck(deck);return;}
  const record=store.load(editingId)||drafts().find(entry=>entry.deck.id===editingId);
  if(record){openSaved(record);if(!deck.hero)openNewDeck(deck);}
  else openNewDeck();
}
function openSaved(record,reading=false){showView('constructor',reading);openDeck(record,!reading);window.scrollTo(0,0);}
function openDeck(record,preferDraft=true) {
  pendingGroupDelete=null;pendingAspects=null;page=1;
  let draft;
  if(preferDraft)try{draft=JSON.parse(sessionStorage.getItem('marvel.draft.'+record.deck.id));}catch{}
  // A clean tab snapshot must never take precedence over the shared saved record.
  if(!draft?.dirty&&record.revision!==null)draft=null;
  const outdatedDraft=draft?.dirty&&record.revision!==null&&draft.revision!==record.revision;
  deck=clone(draft?.deck||record.deck);revision=draft?draft.revision:record.revision;dirty=draft?.dirty||false;
  deck.artwork??={};deck.auxiliaries??={};cleanupUndo=null;
  const grouped=initializeGroups(deck);if(grouped&&!readOnly)dirty=true;
  const restored=readOnly?0:ensureHeroCards(deck,cards);if(restored)dirty=true;
  if(!readOnly){editingId=deck.id;saveDraft();}render();status(readOnly?'Consulta del mazo · Sin edición.':outdatedDraft?'Hay una revisión más reciente guardada. Se conservó tu borrador en esta pestaña.':restored?`Se restituyeron ${restored} copias obligatorias en el borrador. El original guardado se conserva.`:dirty?'Borrador recuperado en esta pestaña.':'Mazo abierto · '+(deck.versions.at(-1)?.label||'Sin versiones guardadas'));
}
function openNewDeck(existing=null){
  setHeroView(true);
  showAlterEgo=false;centeredHeroForm=null;stopHeroWheel();
  $('hero-select').selectedIndex=1;
  $('new-deck-aspects').multiple=true;
  delete $('new-deck-aspects').dataset.fixed;
  for(const option of $('new-deck-aspects').options)option.selected=Boolean(existing?.aspects.includes(option.value));
  updateNewDeckControls();
  $('build-deck').onclick=()=>{
    if($('build-deck').disabled)return;
    const next=existing?clone(existing):createDeck();
    next.hero=$('hero-select').value;next.aspects=newDeckAspects();
    const build=()=>{
      $('new-deck-dialog').close();
      if(existing){deck=next;ensureHeroCards(deck,cards);}
      else{
        openSaved({deck:next,revision:null});
        startNewDeckFilter();
      }
      updateAutoName();changed();
    };
    const active=!readOnly&&deck.id===editingId
      ? {deck,revision,dirty}
      : drafts().find(entry=>entry.deck.id===editingId);
    if(!existing&&active?.dirty)confirmNewDeck(active,build);
    else build();
  };
  $('new-deck-dialog').showModal();
  $(showHeroDisplay?'hero-next':'hero-select').focus();
}
function confirmNewDeck(active,build){
  const body=el('div'), modal=$('modal');
  const error=el('p',undefined,'warning');
  error.hidden=true;error.setAttribute('role','alert');
  const fail=message=>{error.textContent=message;error.hidden=false;};
  const finish=()=>{modal.close();build();};
  const discard=button('Descartar cambios actuales y crear nuevo mazo',()=>{
    if(saving){fail('Hay un guardado en curso. Espera un momento y vuelve a intentarlo.');return;}
    const id=active.deck.id;
    try{
      localStorage.removeItem('marvel.recovery.'+id+'.'+pageId);
      sessionStorage.removeItem('marvel.draft.'+id);
      if(sessionStorage.getItem('marvel.last')===id)sessionStorage.removeItem('marvel.last');
    }catch(e){fail('No se pudo descartar el borrador. '+e.message);return;}
    finish();
  });
  const cancel=button('Cancelar',()=>modal.close());
  const save=button('Guardar cambios actuales y crear nuevo mazo',async()=>{
    error.hidden=true;
    for(const control of controls)control.disabled=true;
    try{
      if(await commit(active,fail))finish();
    }finally{
      for(const control of controls)control.disabled=false;
    }
  },'primary');
  const controls=[discard,save,cancel,$('close-modal')];
  const preventCancel=event=>{if(cancel.disabled)event.preventDefault();};
  body.append(el('p','Tienes cambios sin guardar en «'+active.deck.name+'».'),
    discard,save,cancel,error);
  popup('Cambios sin guardar',body);
  modal.addEventListener('cancel',preventCancel);
  modal.addEventListener('close',()=>modal.removeEventListener('cancel',preventCancel),{once:true});
  cancel.focus();
}
function newDeckAspects(){return [...$('new-deck-aspects').selectedOptions].map(option=>option.value);}
let previewHero=null;
function updateNewDeckControls(){
  const hero=cards[$('hero-select').value], aspects=$('new-deck-aspects'), count=requiredAspectCount(hero);
  aspects.multiple=count>1;
  if(count===4){
    for(const option of aspects.options)option.selected=baseAspectCodes.includes(option.value);
    aspects.dataset.fixed='';
  }else if('fixed' in aspects.dataset){
    aspects.selectedIndex=-1;
    delete aspects.dataset.fixed;
  }
  aspects.disabled=!hero||count===4;
  const selected=newDeckAspects().length;
  $('new-deck-aspect-rule').textContent=count===4?'Adam Warlock usa los cuatro aspectos base.':hero?`Elige ${count} ${count===1?'aspecto':'aspectos'} · ${selected} de ${count}`:'Elige primero un héroe.';
  $('hero-detail').disabled=!hero;
  $('build-deck').disabled=Boolean(previewHero)||!hero||selected!==count;
  if(showHeroDisplay)renderHeroDisplay();
}
function setHeroView(display){
  showHeroDisplay=display;
  $('new-deck-dialog').classList.toggle('hero-display-mode',display);
  $('hero-view-toggle').textContent=display?'Listado':'Display';
  $('hero-list').hidden=display;$('hero-display').hidden=!display;
  $('hero-detail').hidden=display;
  $('hero-acceleration-control').hidden=!display;
}
function heroBand(){
  return [...$('hero-select').options].slice(1).flatMap(entry=>{
    const forms=heroOptions.get(entry.value)||[];
    const heroes=forms.filter(card=>card.en.type_code==='hero');
    const alters=[...new Set(heroes.map(card=>cards[card.links.other_face]).filter(card=>card?.en.type_code==='alter_ego'))];
    const visible=showAlterEgo&&alters.length?alters:heroes;
    return visible.map(card=>({entry,card}));
  });
}
function heroBandIndex(band){
  if(previewHero)return band.findIndex(({card})=>card.code===previewHero.card.code);
  const hero=$('hero-select').value;
  const index=band.findIndex(({entry,card})=>entry.value===hero&&card.code===centeredHeroForm);
  return index<0?band.findIndex(({entry})=>entry.value===hero):index;
}
function stopHeroWheel(){
  wheelDistance=0;lastWheelTime=performance.now();heroWheelPaused=true;
}
function waitForWorker(worker,states){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(new Error('La actualización tardó demasiado. Inténtalo de nuevo.')),30000);
    function finish(error){
      clearTimeout(timer);worker.removeEventListener('statechange',check);
      if(error)reject(error);else resolve();
    }
    function check(){
      if(worker.state==='redundant')finish(new Error('El navegador descartó la actualización.'));
      else if(states.includes(worker.state))finish();
    }
    worker.addEventListener('statechange',check);check();
  });
}
function openSettings(){
  const body=el('div'), feedback=el('p');
  feedback.setAttribute('role','status');
  const check=button('Buscar actualización',async()=>{
    check.disabled=true;
    feedback.textContent='Buscando actualización…';
    try{
      const registration=location.protocol==='https:'&&'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null;
      if(!registration){
        feedback.textContent='Para cargar los cambios del servidor local, recarga la página.';
        return;
      }
      if(!registration.waiting)await registration.update();
      const worker=registration.waiting||registration.installing;
      if(!worker){feedback.textContent='Ya tienes la última versión disponible.';return;}
      await waitForWorker(worker,['installed','activating','activated']);
      if(saving||pendingAspects||(!readOnly&&dirty&&!saveDraft())){
        feedback.textContent='Termina los cambios pendientes del mazo y vuelve a buscar la actualización.';
        return;
      }
      feedback.textContent='Aplicando actualización…';
      worker.postMessage('apply-update');
      await waitForWorker(worker,['activated']);
      location.reload();
    }catch(e){feedback.textContent='No se pudo actualizar. '+e.message;}
    finally{check.disabled=false;}
  },'primary');
  body.append(check,button('Mi colección',collectionDialog),feedback);
  popup('Configuración',body);
}
function centerHero({entry,card}){
  $('hero-select').value=entry.value;
  centeredHeroForm=card.code;
  updateNewDeckControls();
}
function stepHero(direction,preview=false){
  const band=heroBand();
  if(!band.length)return;
  const index=heroBandIndex(band);
  const item=band[index<0?(direction>0?0:band.length-1):((index+direction)%band.length+band.length)%band.length];
  if(preview){
    previewHero=item;
    renderHeroDisplay();
  }else{
    previewHero=null;
    centerHero(item);
  }
}
function renderHeroDisplay(){
  const band=heroBand(),index=heroBandIndex(band),images=$('hero-track');
  images.replaceChildren();
  $('hero-face-toggle').textContent=showAlterEgo?'Ver héroe':'Ver alter ego';
  if(index<0)return;
  $('hero-display-name').textContent=band[index].entry.textContent;
  for(const offset of [-2,-1,0,1,2]){
    const item=band[(index+offset+band.length)%band.length],card=item.card;
    const group=el('div',undefined,'hero-carousel-group');
    group.dataset.offset=String(offset);
    const name=card[heroLanguage]?.name||title(card);
    const face=button('',()=>{
      stopHeroWheel();
      if(offset){centerHero(item);images.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});}
      cardDetail(card.code);
    },'hero-carousel-card');
    face.setAttribute('aria-label','Seleccionar '+name+' · '+item.entry.textContent);
    face.setAttribute('aria-pressed',String(!offset&&!previewHero));
    if(card.image)face.append(previewImage(card,card.image));
    else face.textContent=name;
    group.append(face);
    if(offset)group.append(el('span',name,'hero-carousel-name'));
    images.append(group);
  }
}
function enableHeroSwipe(){
  const viewport=$('hero-faces'),track=$('hero-track');
  const duration=2300;
  let gesture,frame=0,offset=0,velocity=0,holdTimer;
  const paint=()=>{track.style.transform=offset?'translateX('+offset+'px)':'';};
  function stop(confirm=true){
    clearTimeout(holdTimer);cancelAnimationFrame(frame);
    frame=0;offset=0;velocity=0;paint();
    if(!previewHero)return;
    const item=previewHero;
    previewHero=null;
    if(confirm)centerHero(item);
  }
  function move(delta,spacing){
    offset+=delta;
    while(Math.abs(offset)>=spacing/2){
      const direction=Math.sign(offset);
      stepHero(-direction,true);
      offset-=direction*spacing;
      if(Math.abs(offset)<=spacing/2)break;
    }
    paint();
  }
  function glide(speed,spacing){
    cancelAnimationFrame(frame);
    const start=performance.now();
    const momentum=Math.max(-8*spacing,Math.min(8*spacing,speed*duration/3));
    const correction=Math.round((offset+momentum)/spacing)*spacing-offset-momentum;
    let previous=0;
    velocity=3*momentum/duration;
    function tick(now){
      const progress=Math.min(1,(now-start)/duration);
      const position=momentum*(1-(1-progress)**3)+correction*progress**3*(4-3*progress);
      velocity=(3*momentum*(1-progress)**2+12*correction*progress**2*(1-progress))/duration;
      move(position-previous,spacing);previous=position;
      if(progress<1)frame=requestAnimationFrame(tick);
      else stop();
    }
    frame=requestAnimationFrame(tick);
  }
  $('hero-display').addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||!viewport.contains(event.target))stop();
  },{capture:true});
  $('new-deck-dialog').addEventListener('keydown',()=>stop(),{capture:true});
  $('new-deck-dialog').addEventListener('close',()=>{gesture=null;stop(false);});
  viewport.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||!event.isPrimary)return;
    const card=track.querySelector('.hero-carousel-card');
    if(!card)return;
    gesture={id:event.pointerId,start:event.clientX,x:event.clientX,time:performance.now(),speed:0,spacing:card.offsetWidth+8,dragging:false,handled:false};
    if(frame){
      viewport.setPointerCapture(event.pointerId);
      gesture.paused=true;
      gesture.resumeSpeed=velocity;
      cancelAnimationFrame(frame);frame=0;
      holdTimer=setTimeout(()=>{gesture.resumeSpeed=0;stop();},180);
    }
  });
  viewport.addEventListener('pointermove',event=>{
    if(gesture?.id!==event.pointerId||gesture.handled)return;
    if(!gesture.dragging){
      if(Math.abs(event.clientX-gesture.start)<9)return;
      gesture.dragging=true;
      $('build-deck').disabled=true;
      if(!previewHero){
        const band=heroBand();
        previewHero=band[heroBandIndex(band)];
      }
      viewport.setPointerCapture(event.pointerId);
      clearTimeout(holdTimer);
      if(gesture.resumeSpeed){
        const direction=Math.sign(event.clientX-gesture.start);
        gesture.handled=true;
        if(direction===Math.sign(gesture.resumeSpeed))glide(gesture.resumeSpeed*1.3,gesture.spacing);
        else stop();
        return;
      }
    }
    const now=performance.now(),delta=event.clientX-gesture.x;
    gesture.speed=delta/Math.max(12,now-gesture.time);
    gesture.x=event.clientX;gesture.time=now;
    move(delta,gesture.spacing);
  });
  viewport.addEventListener('pointerup',event=>{
    if(gesture?.id!==event.pointerId)return;
    const {dragging,speed,time,spacing,handled,paused}=gesture;gesture=null;
    clearTimeout(holdTimer);
    if(dragging&&!handled)glide(performance.now()-time<100?speed:0,spacing);
    else if(!dragging&&paused)stop();
  });
  viewport.addEventListener('pointercancel',()=>{gesture=null;stop();});
}
function updateTraitMode(){
  const advanced=otherPressed('advanced-traits');
  $('advanced-trait-panel').hidden=!advanced;
  $('hero-trait-interaction').hidden=advanced;
}
function currentHeroTraits(){
  if(!deck?.hero)return [];
  if(!heroTraitsByCode.has(deck.hero))heroTraitsByCode.set(deck.hero,heroSetTraits(cards[deck.hero],cards));
  return heroTraitsByCode.get(deck.hero);
}
function duplicate(source=deck) {const d=clone(source);d.id=crypto.randomUUID();d.name+=' · copia';d.autoName=false;d.armed=false;showView('constructor');openDeck({deck:d,revision:null},false);changed();}
function updateAutoName(){
  const automatic=deck.autoName ?? normalize(deck.name).trim()==='nuevo mazo';
  if(!automatic||!deck.hero)return;
  deck.autoName=true;
  const existing=new Map(store.list().map(r=>[r.deck.id,r.deck]));
  for(const d of drafts())existing.set(d.deck.id,d.deck);
  deck.name=automaticName(deck,cards[deck.hero],[...existing.values()]);
}
async function commit(draft=null,showError=status) {
  if(saving){showError('Hay un guardado en curso. Espera un momento y vuelve a intentarlo.');return;}
  if(!draft&&readOnly)return;
  if(!navigator.locks) {showError('Este navegador no ofrece bloqueo entre pestañas. Exporta el borrador; usa un navegador actualizado para guardar con seguridad.');return;}
  const source=draft?.deck||deck;
  const name=source.name.trim();
  if(!name){
    if(draft){showError('Pon un nombre al mazo actual antes de guardarlo.');return;}
    if($('deck-panel').hidden)$('deck-tab').click();
    $('deck-name').value=name;
    $('deck-name').reportValidity();
    $('deck-name').focus();
    return;
  }
  if(source===deck)source.name=name;
  const captured=clone(source),expected=draft?draft.revision:revision;
  captured.name=name;ensureHeroCards(captured,cards);
  const label=nextVersionNumber(captured);
  if(captured.versions.length>=100){showError('Se alcanzaron 100 versiones: duplica el mazo o exporta un respaldo.');return;}
  if(source===deck)ensureHeroCards(deck,cards);
  saving=true;renderSaveChanges();
  try {
    const saved=await navigator.locks.request('marvel.deck.'+captured.id,()=>store.save(addVersion(captured),expected));
    if(!readOnly&&deck.id===captured.id && JSON.stringify(deck)===JSON.stringify(captured)){
      deck=saved.deck;revision=saved.revision;dirty=false;saveDraft();render();
    } else if(!readOnly&&deck.id===captured.id){
      // Keep edits made while the save waited; advance their base revision and history.
      deck.versions=saved.deck.versions;revision=saved.revision;saveDraft();
    } else {
      const key='marvel.draft.'+captured.id;const pending=JSON.parse(sessionStorage.getItem(key)||'null');
      if(pending){
        pending.revision=saved.revision;
        if(draft&&JSON.stringify(pending.deck)===JSON.stringify(source)){
          pending.deck=saved.deck;pending.dirty=false;
        }else{
          pending.deck.versions=saved.deck.versions;pending.dirty=JSON.stringify(pending.deck)!==JSON.stringify(saved.deck);
        }
        const value=JSON.stringify(pending);
        sessionStorage.setItem(key,value);
        if(draft)localStorage.setItem('marvel.recovery.'+captured.id+'.'+pageId,value);
      }
      renderDeck();
    }
    status('Guardado: '+label+' · '+new Date().toLocaleTimeString('es-CL'));
    return true;
  } catch(e) {
    if(draft){showError('No se pudo completar el guardado. '+e.message);return;}
    const body=el('div');body.append(el('p','El guardado se detuvo. Tu borrador sigue en esta pestaña. '+e.message));
    body.append(button('Guardar como otro mazo',()=>{duplicate(captured);$('modal').close();status('Copia preparada: guarda una versión para conservarla.');}));
    body.append(button('Conservar una copia y abrir la última versión',()=>{const latest=store.load(captured.id);if(!latest)return;duplicate(captured);openDeck(latest,false);$('modal').close();status('Última versión abierta. El borrador anterior quedó como copia recuperable en Mazos.');}));
    body.append(button('Exportar este borrador',exportDeck));popup('No se sobrescribió el mazo',body);status(e.message);
  }finally{saving=false;renderSaveChanges();}
}
function exportDeck(source=deck){
  const name=source.name.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'mazo';
  download(name+'.json',JSON.stringify({format:'marvel-decks-v1',catalogRevision:catalog.revision,decks:[source]},null,2));
}
function exportText(){
  const line=(code,n)=>{const card=cards[code];const aspect=factions[card.en.faction_code]||card.en.faction_name;return aspect+' - '+title(card)+(n>1?' ×'+n:'');};
  const lines=Object.entries(deck.cards).map(([code,n])=>line(code,n));
  for(const [code,n] of Object.entries(auxiliaryCards(deck,cards)))lines.push(line(code,n));
  download('mazo.txt',lines.join('\n'),'text/plain;charset=utf-8');
}
function familyQuantity(code){return Object.entries(deck.cards).filter(([k])=>canonical(cards[k],cards)===code).reduce((s,[,n])=>s+n,0);}
function setQuantity(code,quantity){
  if(readOnly||!$('library-view').hidden)return;
  const root=canonical(cards[code],cards);
  if(deck.auxiliaries[root]){setAuxiliaryQuantity(root,quantity);return;}
  if(!canSetQuantity(deck,root,quantity,cards)){status('Las cartas obligatorias del héroe no se pueden retirar ni reducir.');return;}
  if(quantity&&!familyQuantity(root)&&!deck.grouping.preferred[root]&&startsInAuxiliaries(cards[root])&&!requiredHeroCards(deck,cards)[root]){
    if(code!==root)deck.artwork[root]=code;
    setAuxiliaryQuantity(root,quantity);
    return;
  }
  // One visible option per physical family, even when importing older printings.
  for(const k of Object.keys(deck.cards))if(canonical(cards[k],cards)===root)delete deck.cards[k];
  if(quantity)deck.cards[root]=quantity;
  if(code!==root)deck.artwork[root]=code;
  changed();
}
function auxiliaryLimit(code){return cards[code].en.type_code==='ally'?1:99;}
function setAuxiliaryQuantity(code,n){
  if(readOnly||!$('library-view').hidden||!Number.isInteger(n)||n<0||n>auxiliaryLimit(code))return;
  if(n)deck.auxiliaries[code]=n;else delete deck.auxiliaries[code];
  changed();
}
function auxiliaryQuantityControl(code){
  const box=el('div',undefined,'auxiliary-quantity'),automatic=automaticAuxiliaries(deck,cards)[code];
  if(automatic){box.append(el('p',`${automatic} copias auxiliares propias del héroe.`,'hint'));return box;}
  const label=el('label','Copias auxiliares'),input=el('input');
  input.type='number';input.min='0';input.max=String(auxiliaryLimit(code));input.value=String(deck.auxiliaries[code]||0);
  input.disabled=readOnly||!$('library-view').hidden;
  input.setAttribute('aria-label','Copias auxiliares de '+title(cards[code]));
  input.onchange=()=>{
    setAuxiliaryQuantity(code,input.valueAsNumber);
    input.value=String(deck.auxiliaries[code]||0);
    if(!deck.auxiliaries[code]&&$('modal').open&&detailCode===code&&cards[code].role==='deck_card')cardDetail(detailCode,detailBack,detailNavigation);
  };
  label.append(input);box.append(label);return box;
}
function quantityControl(c,onQuantityChange) {
  const box=el('div',undefined,'qty');if(readOnly||!$('library-view').hidden)return box;
  const root=canonical(c,cards),n=familyQuantity(root),min=requiredHeroCards(deck,cards)[root]||0,max=Math.max(min,deckLimit(c,deck,cards));
  if(deck.auxiliaries?.[root])return auxiliaryQuantityControl(root);
  box.style.setProperty('--quantity-count',String(max+1));
  for(let i=0;i<=max;i++){const b=button(String(i),()=>{
    setQuantity(c.code,i);
    const quantity=familyQuantity(root);
    for(const control of box.children){const active=Number(control.textContent)===quantity;control.classList.toggle('active',active);control.setAttribute('aria-pressed',String(active));}
    onQuantityChange?.();
  },i===n?'active':'');b.setAttribute('aria-label',`${i} copias de ${title(c)}`);b.setAttribute('aria-pressed',String(i===n));b.disabled=i<min;if(i<min)b.title='Carta obligatoria del héroe';box.append(b);}
  return box;
}
function rulesNode(value,className='rules'){
  const node=el('p',undefined,className);for(const part of ruleTextParts(value))node.append(part.bold?el('strong',part.text,'rule-trait'):document.createTextNode(part.text));return node;
}
function cardDetail(code,back=false,origin=null) {
  hideHover();closePinPopover();
  const original=cards[code];
  if(origin instanceof DetailNavigation)detailNavigation=origin;
  else if(!origin&&original.role==='identity'){
    detailNavigation=new DetailNavigation('identity',identityPreviewCards(original,cards).map(card=>card.code),code);
  }
  else {const codes=origin==='gallery'?galleryDetailCodes:origin==='deck'?[...$('deck-list').querySelectorAll('.deck-row')].map(row=>row.dataset.detailCode):origin==='deck-detail'?[...$('deck-detail-gallery').querySelectorAll('.card')].map(card=>card.dataset.code):[code];detailNavigation=new DetailNavigation(origin,codes,code);}
  detailNavigation.select(code);detailCode=code;detailBack=back;
  const c=back&&original.links.other_face?cards[original.links.other_face]:original;
  const body=el('div',undefined,'detail');
  const src=back&&!original.links.other_face?original.backImage:c.image;
  if(src){
    const image=previewImage(c,src,'detail-image');
    if(c.en.type_code==='player_side_scheme'){
      const frame=el('div',undefined,'side-scheme-detail');
      image.addEventListener('load',()=>{
        frame.style.aspectRatio=String(image.naturalHeight/image.naturalWidth);
        image.style.width=(100*image.naturalWidth/image.naturalHeight)+'%';
      });
      frame.append(image);
      body.append(frame);
    }else body.append(image);
  }
  const info=el('div');info.append(el('h3',title(c)),el('p',[c.es.type_name,c.es.traits].filter(Boolean).join(' · '),'muted'));
  if(original.links.other_face||original.backImage){
    const target=back?original:cards[original.links.other_face];
    const caption=original.role==='identity'?(target?.en.type_code==='alter_ego'?'Ver Alter ego':'Ver Héroe'):(back?'Ver anverso':'↻ Ver otra cara');
    info.append(button(caption,()=>{
      if(detailNavigation.source==='identity'&&target)return cardDetail(target.code,false,detailNavigation);
      cardDetail(code,!back,detailNavigation);
    }));
  }
  info.append(rulesNode(back&&!original.links.other_face?original.es.back_text:c.es.text));
  if(c.imageReference)info.append(el('p','Imagen de otra impresión: '+c.imageReference,'muted'));
  info.append(el('p','Las imágenes pueden estar en inglés. El texto se muestra en español cuando está disponible.','muted'));
  if(Object.values(c.coverage||{}).some(x=>x.status==='fallback_en')) info.append(el('p','Hay campos sin traducción: se conserva el texto inglés.','badge'));
  const english=el('details');english.append(el('summary','Texto auxiliar en inglés'),rulesNode(c.en.text));info.append(english);
  if(c.role==='deck_card'){
    const root=canonical(c,cards);
    let groups=groupPreferences(root);
    const required=requiredHeroCards(deck,cards)[root]||0;
    const fixed=required>0&&deckLimit(original,deck,cards)<=required&&!deck.auxiliaries?.[root];
    const quantities=fixed?el('span',String(familyQuantity(root)),'detail-fixed-copies'):quantityControl(original,()=>{
      if(deck.auxiliaries[root]){cardDetail(detailCode,detailBack,detailNavigation);return;}
      const updated=groupPreferences(root);
      groups.replaceWith(updated);
      groups=updated;
    });
    info.append(quantities,artworkPicker(root,original),groups);
  }
  if(c.role==='hero_auxiliary')info.append(auxiliaryQuantityControl(c.code));
  if(c.role==='identity'){
    const related=Object.values(cards).filter(x=>x.links.set===original.links.set && x.role==='hero_auxiliary');
    if(related.length){info.append(el('h4','Auxiliares del héroe'));for(const a of related)info.append(button(title(a),()=>cardDetail(a.code)));}
    const aux=Object.values(cards).filter(x=>x.links.parent_hero_set===original.links.set && x.role==='hero_auxiliary'&&!x.en.hidden);
    for(const a of aux)if(!related.some(x=>x.code===a.code))info.append(button('Auxiliar: '+title(a),()=>cardDetail(a.code)));
  }
  body.append(info);popup(title(c),body,true);
  const copies=info.querySelector('.detail-fixed-copies, .qty:not(:empty)');
  if(copies){
    const bar=el('div',undefined,'detail-copy-bar');
    bar.append(el('strong','Copias en el mazo'),copies);
    placeDetailCopies(bar);
  }
  renderDetailTools();
}
function renderDetailTools(){
  if(!detailCode||!$('modal').open)return;
  $('detail-prev').disabled=!detailNavigation?.canNavigate;$('detail-next').disabled=!detailNavigation?.canNavigate;
  const slot=$('detail-pins');slot.replaceChildren();if(presetsReady&&cards[detailCode]?.role==='deck_card')slot.append(pinControls(cards[detailCode]));
}
function navigateDetail(direction){if(!detailNavigation?.canNavigate)return;const code=detailNavigation.step(direction);if(code)cardDetail(code,false,detailNavigation);}
function detailShortcut(event){
  if(!detailCode||!$('modal').open||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing)return;
  const target=event.target,editing=target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
  if(editing&&!editing.matches('.group-preferences input[type="radio"]'))return;
  if(!$('pin-popover').hidden&&$('pin-popover').contains(target))return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();navigateDetail(event.key==='ArrowLeft'?-1:1);return;}
  if(/^\d$/.test(event.key)){
    event.preventDefault();const quantity=Number(event.key),card=cards[detailCode];if(readOnly||!$('library-view').hidden||card.role!=='deck_card')return;
    const root=canonical(card,cards);if(!canSetQuantity(deck,root,quantity,cards))return;
    if(deck.auxiliaries?.[root]){setAuxiliaryQuantity(root,quantity);cardDetail(detailCode,detailBack,detailNavigation);return;}
    const control=[...$('modal').querySelectorAll('.detail-copy-bar .qty button')].find(button=>Number(button.textContent)===quantity);if(control&&!control.disabled)control.click();return;
  }
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){
    const options=[...$('modal-body').querySelectorAll('.group-preferences input[type="radio"]:not(:disabled)')];if(!options.length)return;
    event.preventDefault();const current=options.findIndex(input=>input.checked),step=event.key==='ArrowUp'?-1:1,index=current<0?(step>0?0:options.length-1):(current+step+options.length)%options.length;if(!options[index].checked)options[index].click();
  }
}
function artworkPicker(root,shown){
  const box=el('fieldset',undefined,'artwork-picker'),options=artworkOptions(root,cards);
  box.hidden=options.length<2;
  if(options.length<2)return box;
  const active=options.find(c=>c.image===shown.image&&c.backImage===shown.backImage)?.code||selectedArtwork(root,deck,cards).code;
  box.append(el('legend','Versión de la carta'));
  for(const c of options){
    const name=(c.es.pack_name||c.en.pack_name||'Producto')+' · '+c.code;
    const label=el('label',undefined,'artwork-option'),radio=el('input');
    label.title=name;radio.type='radio';radio.name='card-artwork';radio.value=c.code;
    radio.checked=c.code===active;radio.disabled=readOnly||!$('library-view').hidden;
    radio.setAttribute('aria-label',name);
    radio.onchange=()=>{
      deck.artwork[root]=c.code;changed();cardDetail(c.code,false,detailNavigation);
      $('modal-body').querySelector('.artwork-picker input:checked')?.focus({preventScroll:true});
    };
    const src=c.image||c.backImage;
    label.append(radio,src?previewImage(c,src,'artwork-thumb'):el('span',c.code,'artwork-thumb'));
    box.append(label);
  }
  box.append(el('p','Las variantes comparten las mismas cantidades y el límite de copias.','hint'));
  return box;
}
function hideHover(){const hover=$('card-hover');if(hover)hover.hidden=true;}
function previewImage(card,src,className){
  const img=el('img');img.src=src;img.alt=title(card);img.className=className;
  return img;
}
function hoverCard(code,anchor,source='deck'){
  if($('modal').open)return;
  const c=cards[code],hover=$('card-hover');if(!c||!hover)return;hover.classList.remove('identity-hover');
  const content=el('div',undefined,'hover-content');content.append(el('h3',title(c),'hover-name'),el('p',[factions[c.en.faction_code],types[c.en.type_code],c.es.traits].filter(Boolean).join(' · '),'hover-meta'));
  content.append(el('p','Coste: '+(c.en.cost===-1?'X':c.en.cost??'Sin coste'),'hover-meta'));
  const printed=Object.keys(resources).filter(key=>key!=='none'&&c.en['resource_'+key]>0).map(key=>`${resources[key]} ×${c.en['resource_'+key]}`);
  content.append(el('p','Recursos: '+(printed.join(' · ')||'Sin recurso'),'hover-resources'),rulesNode(c.es.text||c.en.text,'hover-rules'),el('p',(c.es.pack_name||c.en.pack_name||'')+' · '+c.code,'hover-pack'));
  const showImage=Boolean(c.image&&(source!=='gallery'||c.en.type_code==='player_side_scheme'));
  hover.classList.toggle('text-only',!showImage);
  hover.replaceChildren();if(showImage)hover.append(previewImage(c,c.image,'hover-image'));hover.append(content);hover.hidden=false;
  const rect=anchor.getBoundingClientRect(),box=hover.getBoundingClientRect();
  const left=rect.right+12+box.width<=innerWidth-8?rect.right+12:Math.max(8,rect.left-box.width-12);
  hover.style.left=Math.min(left,Math.max(8,innerWidth-box.width-8))+'px';hover.style.top=Math.max(8,Math.min(rect.top,innerHeight-box.height-8))+'px';
}
function hoverIdentity(code,anchor){
  if($('modal').open)return;
  const identities=identityPreviewCards(cards[code],cards),hover=$('card-hover');if(!identities.length)return;
  hover.classList.remove('text-only');hover.classList.add('identity-hover');hover.replaceChildren();
  for(const identity of identities){
    const section=el('section',undefined,'identity-preview'),content=el('div',undefined,'hover-content');
    content.append(el('h3',(identity.en.type_code==='alter_ego'?'Alter ego':'Héroe')+' · '+title(identity),'hover-name'),el('p',identity.es.traits||identity.en.traits||'','hover-meta'),rulesNode(identity.es.text||identity.en.text,'hover-rules'));
    if(identity.image)section.append(previewImage(identity,identity.image,'hover-image'));section.append(content);hover.append(section);
  }
  hover.hidden=false;const rect=anchor.getBoundingClientRect(),box=hover.getBoundingClientRect();
  hover.style.left=Math.max(8,Math.min(rect.left,innerWidth-box.width-8))+'px';hover.style.top=(rect.bottom+box.height+8<=innerHeight?rect.bottom+6:Math.max(8,rect.top-box.height-6))+'px';
}
function attachHover(node,code,source='deck'){
  node.setAttribute('aria-describedby','card-hover');
  const show=()=>source==='identity'?hoverIdentity(code,node):hoverCard(code,node,source);
  node.onpointerenter=e=>{if(e.pointerType==='mouse'||e.pointerType==='pen')show();};node.onpointerleave=hideHover;node.onfocus=show;node.onblur=hideHover;
}
function otherPressed(id){return $(id).getAttribute('aria-pressed')==='true';}
function setOtherPressed(id,pressed){$(id).setAttribute('aria-pressed',String(Boolean(pressed)));}
function getFilter(){return {search:$('search').value,searchFields:{name:$('search-name').checked,text:$('search-text').checked},traitSources:{attribute:$('trait-in-attribute').checked,text:$('trait-in-text').checked},allyStats:allyFilter,language:$('search-language').value,factions:[...selection.faction],types:[...selection.type],traits:selectedTraits,advancedTraits:otherPressed('advanced-traits'),heroTraitInteraction:!otherPressed('advanced-traits')&&otherPressed('hero-trait-interaction'),heroTraits:currentHeroTraits(),costs:[...selection.cost],hideHero:!otherPressed('hide-hero'),sameAspect:otherPressed('same-aspect'),resources:[...selection.resource],specialRule:specialRuleFor(cards[deck.hero]),owned:otherPressed('owned-only'),sorts:[$('sort').value,$('sort-secondary').value,$('sort-tertiary').value]};}
function currentPreset(){return presets.find(p=>p.id===activePresetId);}
function startNewDeckFilter(){
  if(!presetsReady)return;
  const previous=getFilter();
  const clean=presetCriteria({
    ...previous,
    search:'',
    searchFields:{name:true,text:true},
    traitSources:{attribute:true,text:true},
    traits:[],
    allyStats:{enabled:previous.allyStats.enabled,values:{}},
    factions:[...Object.keys(factions),'special'],
    types:Object.keys(types),
    costs:costOptions.map(([code])=>code),
    resources:Object.keys(resources),
  });
  let preset=presets.find(item=>!item.onlyPinned&&!item.pins.length
    &&!Object.values(item.ui?.single||{}).some(Boolean)
    &&JSON.stringify(item.criteria)===JSON.stringify(clean));
  if(!preset){
    let number=1;
    while(presets.some(item=>item.name==='Filtro '+number))number++;
    preset=createPreset(clean,'Filtro '+number);
    try{filterStore.save(preset);}catch(e){report(e);return;}
    presets.push(preset);
  }
  for(const item of presets){
    const enabled=item.id===preset.id;
    if(item.enabled!==enabled)savePresetPatch(item.id,record=>{record.enabled=enabled;});
  }
  applyPreset(preset);
}
function refreshSearchFields(){for(const [id,other]of [['search-name','search-text'],['search-text','search-name']])$(id).disabled=$(id).checked&&!$(other).checked;}
function refreshTraitSources(){
  if(!$('trait-in-attribute').checked&&!$('trait-in-text').checked)$('trait-in-attribute').checked=true;
  for(const [id,other]of [['trait-in-attribute','trait-in-text'],['trait-in-text','trait-in-attribute']])$(id).disabled=$(id).checked&&!$(other).checked;
}
function savePresetPatch(id,mutate){
  const local=presets.find(p=>p.id===id);if(!local)return Promise.resolve();mutate(local);filterWrites++;
  return filterStore.update(id,mutate).catch(report).finally(()=>{filterWrites--;if(!filterWrites&&presetRefreshPending){presetRefreshPending=false;reloadPresets();}});
}
function captureActivePreset(edited=false){
  if(!presetsReady||applyingPreset)return;const active=currentPreset();if(!active)return;
  const criteria=presetCriteria(getFilter()),ui={single:{...single},lastChoice:{...lastChoice}};
  const criteriaChanged=JSON.stringify(active.criteria)!==JSON.stringify(criteria);
  const show=edited&&advancedFilters&&criteriaChanged&&!active.enabled;
  if(criteriaChanged||JSON.stringify(active.ui)!==JSON.stringify(ui)){
    savePresetPatch(active.id,p=>{p.criteria=criteria;p.ui=ui;if(show)p.enabled=true;});
  }
  if(show)renderFilterTabs();
}
function renderEditedFilter(){captureActivePreset(true);renderGallery();}
function applyPreset(preset){
  if(!preset)return;applyingPreset=true;activePresetId=preset.id;
  const f=preset.criteria;allyFilter=normalizeAllyFilter(f.allyStats,allyOptions);$('search').value=f.search||'';$('search-language').value=f.language||'es';$('search-name').checked=f.searchFields?.name!==false;$('search-text').checked=f.searchFields?.text!==false;refreshSearchFields();
  $('trait-in-attribute').checked=f.traitSources?.attribute!==false;$('trait-in-text').checked=f.traitSources?.text===true;refreshTraitSources();
  setOtherPressed('hide-hero',!f.hideHero);setOtherPressed('same-aspect',f.sameAspect);
  for(const [key,field]of [['faction','factions'],['type','types'],['cost','costs'],['resource','resources']]){selection[key]=new Set(f[field]||[]);single[key]=preset.ui?.single?.[key]===true;lastChoice[key]=preset.ui?.lastChoice?.[key];}
  setOtherPressed('advanced-traits',f.advancedTraits);setOtherPressed('hero-trait-interaction',f.heroTraitInteraction);updateTraitMode();
  selectedTraits=[...(f.traits||[])];$('trait-filter').value='';toggleTraitSuggestions(false);toggleTraitList(false);closePinPopover();
  checklist('type',Object.entries(types));checklist('cost',costOptions);checklist('resource',Object.entries(resources));renderFactionFilter();
  try{sessionStorage.setItem('marvel.active-filter',preset.id);}catch{}applyingPreset=false;page=1;renderFilterTabs();renderGallery();
}
function reloadPresets(){
  if(filterWrites){presetRefreshPending=true;return;}presets=filterStore.list();
  if(!presets.length){const first=createPreset(getFilter());filterStore.save(first);presets=[first];}
  applyPreset(currentPreset()||presets[0]);
}
function setupPresets(){
  filterStore=new FilterPresetStore(localStorage,cards);presets=filterStore.list();
  if(!presets.length){const first=createPreset(getFilter());filterStore.save(first);presets=[first];}
  advancedFilters=localStorage.getItem('marvel.filters.enabled')==='true';setOtherPressed('advanced-filters',advancedFilters);presetsReady=true;
  let active='';try{active=sessionStorage.getItem('marvel.active-filter');}catch{}
  const preset=presets.find(p=>p.id===active)||presets[0];
  const owned=localStorage.getItem('marvel.filters.owned');
  setOtherPressed('owned-only',owned===null?preset.criteria.owned:owned==='true');
  if(owned===null)try{localStorage.setItem('marvel.filters.owned',String(otherPressed('owned-only')));}catch{}
  applyPreset(preset);
}
function renderFilterTabs(){
  const enabled=presetsReady&&advancedFilters;$('config-bar').classList.toggle('advanced-filters',enabled);$('filter-presets').hidden=!enabled||$('filter-panel').hidden;$('preset-tools').hidden=!enabled;
  const active=currentPreset();
  if(!enabled)return;
  const scroll=$('filter-presets').scrollLeft;
  $('filter-presets').replaceChildren();
  for(const p of presets){const pill=el('div',undefined,'preset-pill'),tab=button(p.name||'Sin nombre',()=>{captureActivePreset();applyPreset(p);},'preset-tab');tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(p.id===activePresetId));tab.title=p.name;tab.setAttribute('aria-controls','filter-panel');
    const eye=button('',()=>{savePresetPatch(p.id,record=>{record.enabled=!record.enabled;});renderFilterTabs();page=1;renderGallery();[...$('filter-presets').querySelectorAll('.preset-eye')].find(control=>control.dataset.preset===p.id)?.focus({preventScroll:true});},'preset-eye');
    eye.dataset.preset=p.id;eye.append(iconSvg(p.enabled?'eye':'eyeOff'),el('span',p.enabled?'Visible':'Oculto'));eye.setAttribute('aria-label',(p.enabled?'Ocultar resultados de ':'Mostrar resultados de ')+p.name);eye.setAttribute('aria-pressed',String(p.enabled));
    const remove=button('×',()=>{const body=el('div');body.append(el('p','Eliminar «'+p.name+'» y sus fijados. Las cartas del mazo se conservan.'));body.append(button('Eliminar filtro',()=>{filterStore.remove(p.id).then(()=>{presets=filterStore.list();$('modal').close();reloadPresets();}).catch(report);},'primary'));popup('Eliminar filtro',body);},'preset-remove');remove.setAttribute('aria-label','Eliminar filtro '+p.name);remove.disabled=presets.length===1;remove.title=remove.disabled?'Debe quedar al menos un filtro':'Eliminar filtro';pill.append(tab,eye,remove);$('filter-presets').append(pill);
  }
  const add=button('＋',()=>{captureActivePreset();let n=1;while(presets.some(p=>p.name==='Filtro '+n))n++;const created=createPreset({...getFilter(),allyStats:{...allyFilter,enabled:false},hideHero:true,sameAspect:true,language:'es'},'Filtro '+n,currentPreset());filterStore.save(created);presets.push(created);applyPreset(created);});add.setAttribute('aria-label','Añadir filtro como copia del actual');add.disabled=presets.length>=100;$('filter-presets').append(add);
  $('filter-presets').scrollLeft=scroll;
  if(active){if(document.activeElement!==$('preset-name'))$('preset-name').value=active.name;$('only-pinned').checked=active.onlyPinned;$('preset-pin-count').textContent=active.pins.length+' fijadas';$('clear-preset-pins').disabled=!active.pins.length;}
}
function closePinPopover(){$('pin-popover').hidden=true;}
function confirmPinClear(key,control,action){
  if(pinConfirmation?.key===key&&pinConfirmation.until>Date.now()){pinConfirmation=null;control.classList.remove('pin-confirming');action();return;}
  for(const old of document.querySelectorAll('.pin-confirming'))old.classList.remove('pin-confirming');
  pinConfirmation={key,until:Date.now()+8000};control.classList.add('pin-confirming');control.title='Pulsa de nuevo para confirmar';
  setTimeout(()=>{if(pinConfirmation?.key===key){pinConfirmation=null;control.classList.remove('pin-confirming');}},8000);
}
function pinControls(card){
  const root=canonical(card,cards),box=el('div',undefined,'pin-actions');
  const direct=singleVisiblePreset(presets,advancedFilters,activePresetId),pinned=direct?direct.pins.includes(root):presets.some(p=>p.pins.includes(root));
  const pin=button('',()=>{
    if(!direct){openPinPopover(root,pin);return;}
    savePresetPatch(direct.id,p=>{p.pins=p.pins.filter(code=>code!==root);if(!pinned)p.pins.push(root);});
    closePinPopover();renderFilterTabs();renderGallery();
  },'pin-button');pin.append(iconSvg('pin'));pin.setAttribute('aria-label','Fijar '+title(card)+(direct?' en '+direct.name:' en filtros'));pin.setAttribute('aria-pressed',String(pinned));
  if(direct){pin.disabled=!pinned&&!presetMatches(cards[root],direct,deck,collection,specialRuleFor(cards[deck.hero]),otherPressed('owned-only'),currentHeroTraits());pin.title=pin.disabled?'La carta no cumple los criterios de '+direct.name:(pinned?'Desfijar de ':'Fijar en ')+direct.name;}
  const clear=button('×',()=>confirmPinClear('card:'+root,clear,()=>{for(const p of presets.filter(p=>p.pins.includes(root)))savePresetPatch(p.id,record=>{record.pins=record.pins.filter(code=>code!==root);});closePinPopover();renderFilterTabs();renderGallery();}),'clear-card-pins');clear.setAttribute('aria-label','Desfijar '+title(card)+' de todos los filtros');clear.title='Desfijar de todos los filtros con dos pulsaciones';clear.disabled=!presets.some(p=>p.pins.includes(root));box.append(pin,clear);return box;
}
function openPinPopover(root,anchor){
  hideHover();const panel=$('pin-popover');($('modal').open?$('modal'):document.body).append(panel);panel.replaceChildren(el('strong',title(cards[root])));let count=0;
  for(const p of presets){const pinned=p.pins.includes(root),compatible=presetMatches(cards[root],p,deck,collection,specialRuleFor(cards[deck.hero]),otherPressed('owned-only'),currentHeroTraits());if(!compatible&&!pinned)continue;count++;
    const label=el('label',undefined,'check-row'),input=el('input');input.type='checkbox';input.checked=pinned;input.setAttribute('aria-label','Fijar en '+p.name);input.onchange=()=>{const checked=input.checked;savePresetPatch(p.id,record=>{record.pins=record.pins.filter(c=>c!==root);if(checked)record.pins.push(root);});renderFilterTabs();renderGallery();closePinPopover();};
    label.append(input,document.createTextNode(p.name+(!compatible?' · fijada fuera del criterio actual':'')));panel.append(label);
  }
  if(!count)panel.append(el('p','Ningún filtro cumple los criterios para esta carta.','hint'));panel.hidden=false;
  const rect=anchor.getBoundingClientRect(),width=Math.min(330,innerWidth-24);panel.style.width=width+'px';const height=panel.getBoundingClientRect().height;panel.style.left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12))+'px';panel.style.top=(rect.bottom+height+8<innerHeight?rect.bottom+6:Math.max(12,rect.top-height-6))+'px';
}
function selectionIcon(state){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 18 18');svg.setAttribute('width','18');svg.setAttribute('height','18');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.25');
  const rect=document.createElementNS(ns,'rect');for(const [key,value]of Object.entries({x:2.5,y:2.5,width:13,height:13,rx:2}))rect.setAttribute(key,String(value));svg.append(rect);
  if(state!=='none'){const mark=document.createElementNS(ns,'path');mark.setAttribute('d',state==='all'?'M5.5 9l2.3 2.4 4.8-5':'M5.5 9h7');mark.setAttribute('stroke-linecap','round');mark.setAttribute('stroke-linejoin','round');svg.append(mark);}return svg;
}
function checklist(key,entries){
  const box=$(key+'-filter');box.replaceChildren();
  function choose(value,checked){
    if(checked){if(single[key])selection[key].clear();selection[key].add(value);lastChoice[key]=value;}else selection[key].delete(value);
    for(const control of box.querySelectorAll('[data-filter-value]'))control.setAttribute('aria-pressed',String(selection[key].has(control.dataset.filterValue)));
    updateToggle();page=1;renderEditedFilter();
  }
  for(const [value,text]of entries){
    const control=button(text,()=>choose(value,!selection[key].has(value)),'filter-choice');
    control.dataset.filterValue=value;
    if(key==='type')control.dataset.typeValue=value;
    if(key==='resource'){
      control.setAttribute('aria-label',text);
      control.title=text;
      if(value==='none')control.textContent='SR';
      else {
        const icon=el('span',undefined,'resource');
        icon.dataset.resource=value;
        icon.append(iconSvg(value));
        control.replaceChildren(icon);
      }
    }
    control.setAttribute('aria-pressed',String(selection[key].has(value)));
    box.append(control);
  }
  const values=entries.map(([value])=>value),toggle=$(key+'-toggle'),exclusive=$(key+'-single');
  function updateToggle(){const state=selectionState(values,selection[key]);toggle.replaceChildren(selectionIcon(state));toggle.dataset.state=state;toggle.setAttribute('aria-pressed',state==='partial'?'mixed':String(state==='all'));toggle.setAttribute('aria-label',state==='all'?'Desmarcar todos':'Marcar todos');toggle.title=(state==='partial'?'Selección parcial. ':'')+(state==='all'?'Desmarcar todos':'Marcar todos');toggle.disabled=!values.length;}
  exclusive.setAttribute('aria-pressed',String(single[key]));exclusive.title='Seleccionar solo una opción';exclusive.replaceChildren(iconSvg('single'));
  const refresh=()=>key==='faction'?renderFactionFilter():checklist(key,entries);
  exclusive.onclick=()=>{single[key]=!single[key];if(single[key]){const selected=values.filter(value=>selection[key].has(value));const keep=selected.includes(lastChoice[key])?lastChoice[key]:selected[0];selection[key]=new Set(keep?[keep]:[]);}refresh();page=1;renderEditedFilter();};
  toggle.onclick=event=>{event.preventDefault();event.stopPropagation();if(selectionState(values,selection[key])!=='all')single[key]=false;selection[key]=toggleSelection(values,selection[key]);refresh();page=1;renderEditedFilter();};updateToggle();
}
function renderFactionFilter(){
  const allowed=allowedFactions(getFilter(),deck),entries=Object.entries(factions).filter(([code])=>allowed.includes(code)),rule=specialRuleFor(cards[deck.hero]);
  if(rule)entries.push(['special','Regla especial']);checklist('faction',entries);if(rule)$('faction-filter').lastElementChild.title=rule.description;
  if(!rule){const control=button('Regla especial',()=>{},'filter-choice');control.disabled=true;control.setAttribute('aria-pressed','false');control.title=deck.hero?'Sin permiso adicional de otros aspectos en las identidades revisadas. Las reglas estructurales se muestran en el mazo.':'Elige un héroe';$('faction-filter').append(control);}
}
function uniqueTraits(values){return [...new Map(values.map(t=>[normalize(t),t])).values()].sort((a,b)=>a.localeCompare(b,'es'));}
function addTrait(text=$('trait-filter').value){
  const value=text.trim().replace(/\.$/,'');if(!value||value.length>100)return;
  const known=allTraits.find(t=>normalize(t)===normalize(value))||playerTraits.find(t=>normalize(t)===normalize(value))||($('trait-in-text').checked?Object.values(TEXT_TOPICS).flatMap(t=>[t.es,t.en]).find(t=>normalize(t)===normalize(value)):undefined);
  if(!known){status('Elige un rasgo de jugador o una mención disponible con En texto.');return;}
  if(!selectedTraits.some(t=>normalize(t)===normalize(known)))selectedTraits.push(known);
  $('trait-filter').value='';page=1;renderTraits();renderEditedFilter();
}
function toggleSearchOptions(open=$('search-options').hidden){
  const panel=$('search-options'),control=$('search-options-toggle');panel.hidden=!open;control.setAttribute('aria-expanded',String(open));
  if(!open)return;
  const rect=control.getBoundingClientRect();panel.style.width=Math.min(220,innerWidth-24)+'px';
  const box=panel.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(rect.right-box.width,innerWidth-box.width-12))+'px';
  panel.style.top=(rect.bottom+box.height+8<=innerHeight?rect.bottom+6:Math.max(12,rect.top-box.height-6))+'px';
}
function toggleTraitSuggestions(open){
  const panel=$('trait-search-options'),control=$('trait-filter');traitSuggestionsOpen=Boolean(open&&control.value.trim());panel.hidden=!traitSuggestionsOpen;control.setAttribute('aria-expanded',String(traitSuggestionsOpen));
  if(!traitSuggestionsOpen)return;toggleTraitList(false);
  const rect=control.getBoundingClientRect();panel.style.width=Math.min(320,innerWidth-24)+'px';
  const box=panel.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(rect.left,innerWidth-box.width-12))+'px';
  panel.style.top=(rect.bottom+box.height+8<=innerHeight?rect.bottom+6:Math.max(12,rect.top-box.height-6))+'px';
}
function toggleTraitList(open=$('deck-traits-options').hidden){
  const panel=$('deck-traits-options'),control=$('deck-traits-button');panel.hidden=!open;control.setAttribute('aria-expanded',String(open));
  if(!open)return;toggleTraitSuggestions(false);
  const rect=control.getBoundingClientRect();panel.style.width=Math.min(320,innerWidth-24)+'px';
  const box=panel.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(rect.right-box.width,innerWidth-box.width-12))+'px';
  panel.style.top=(rect.bottom+box.height+8<=innerHeight?rect.bottom+6:Math.max(12,rect.top-box.height-6))+'px';
}
function traitChoice(text,count){const label=el('label',undefined,'check');const input=el('input');input.type='checkbox';input.checked=selectedTraits.some(t=>normalize(t)===normalize(text));input.setAttribute('aria-label',text);label.title=Object.values(TEXT_TOPICS).some(t=>t.es===text||t.en===text)?'Mención a planes secundarios en las reglas; no es un rasgo propio.':`${count} cartas distintas con este rasgo`;
  input.onchange=()=>{const fromDeck=$('deck-traits-options').contains(input),fromSuggestions=$('trait-search-options').contains(input);if(input.checked)addTrait(text);else{selectedTraits=selectedTraits.filter(t=>normalize(t)!==normalize(text));page=1;renderTraits();renderEditedFilter();}if(fromDeck){toggleTraitList(false);$('deck-traits-button').focus();}if(fromSuggestions){$('trait-filter').value='';toggleTraitSuggestions(false);$('trait-filter').focus();}};label.append(input,document.createTextNode(`${text} (${count})`));return label;
}
function renderTraits(){
  const sources=getFilter().traitSources,tallies=traitCounts(filterCards(choices,{...getFilter(),traits:[]},deck,collection),undefined,sources);allTraits=tallies.map(t=>t.name);
  const sortTraits=(entries,mode)=>entries.sort((a,b)=>(mode==='count'?b.count-a.count:0)||a.name.localeCompare(b.name,'es'));
  const byName=new Map(tallies.map(t=>[normalize(t.name),t.count]));
  $('selected-traits').replaceChildren();for(const t of selectedTraits){const chip=el('span',undefined,'trait-chip');const remove=button('×',()=>{selectedTraits=selectedTraits.filter(x=>x!==t);page=1;renderTraits();renderEditedFilter();});remove.setAttribute('aria-label','Quitar rasgo '+t);chip.append(document.createTextNode(`${t} (${byName.get(normalize(t))||0})`),remove);$('selected-traits').append(chip);}
  const query=normalize($('trait-filter').value.trim());$('trait-suggestions').replaceChildren();
  if(query){const matches=sortTraits(tallies.filter(t=>normalize(t.name).includes(query)),traitSort);for(const t of matches)$('trait-suggestions').append(traitChoice(t.name,t.count));if(!matches.length)$('trait-suggestions').append(el('p','Sin coincidencias con estos filtros.','hint'));}
  toggleTraitSuggestions(Boolean(query&&traitSuggestionsOpen));
  const inDeck=Object.keys(deck.cards).filter(code=>deck.cards[code]>0).map(code=>cards[code]);
  if(deck.hero){const set=cards[deck.hero].links.set;inDeck.push(...Object.values(cards).filter(c=>c.role==='identity'&&c.links.set===set));}
  const deckTraits=traitCounts(inDeck.filter(Boolean),c=>canonical(c,cards),sources),availableTraits=traitCounts(availableRecords,c=>canonical(c,cards),sources),list=sortTraits(traitListView==='deck'?deckTraits:availableTraits,deckTraitSort);$('deck-traits').replaceChildren();
  $('trait-list-deck').setAttribute('aria-selected',String(traitListView==='deck'));$('trait-list-available').setAttribute('aria-selected',String(traitListView==='available'));$('deck-traits').setAttribute('aria-label',traitListView==='deck'?'Rasgos en el mazo':'Rasgos en cartas disponibles');
  for(const t of list)$('deck-traits').append(traitChoice(t.name,t.count));if(!list.length)$('deck-traits').append(el('p',traitListView==='deck'?'Elige un héroe o añade cartas al mazo.':'No hay rasgos en las cartas disponibles con estos filtros.','hint'));
  for(const [id,mode]of [['trait-sort',traitSort],['deck-traits-sort',deckTraitSort]]){$(id).textContent=mode==='name'?'A–Z':'# ↓';$(id).title=mode==='name'?'Ordenar por cantidad de cartas':'Ordenar de A a Z';}
}
function renderAllyFilters(){
  setOtherPressed('advanced-allies',allyFilter.enabled);$('ally-options').hidden=!allyFilter.enabled||$('filter-panel').hidden;
  const box=$('ally-stat-controls');box.replaceChildren();
  for(const [field,name]of ALLY_STATS){const row=el('div',undefined,'ally-stat-row'),heading=el('div',undefined,'ally-stat-heading'),options=el('div',undefined,'ally-values'),available=allyOptions[field]||[],selected=new Set(allyFilter.values[field]||available),state=selectionState(available,selected);
    const toggle=button('',()=>{setAllyStatValues(allyFilter,field,state==='all'?[]:available,available);page=1;renderEditedFilter();},'ally-toggle');toggle.append(selectionIcon(state));toggle.dataset.state=state;toggle.setAttribute('aria-pressed',state==='partial'?'mixed':String(state==='all'));toggle.setAttribute('aria-label',(state==='all'?'Desmarcar todos los valores de ':'Marcar todos los valores de ')+name);toggle.title=(state==='partial'?'Selección parcial. ':'')+(state==='all'?'Desmarcar todos':'Marcar todos');toggle.disabled=!available.length;heading.append(el('strong',name),toggle);
    options.setAttribute('role','group');options.setAttribute('aria-label',name+' de aliados');row.append(heading,options);
    for(const value of available){const control=button(value==='variable'?'Variable':value==='0'?'0 / —':value,()=>{const values=new Set(allyFilter.values[field]||available);if(values.has(value))values.delete(value);else values.add(value);setAllyStatValues(allyFilter,field,[...values],available);page=1;renderEditedFilter();},'filter-choice ally-value');control.dataset.allyField=field;control.dataset.allyValue=value;control.setAttribute('aria-pressed',String(selected.has(value)));control.setAttribute('aria-label',name+' '+(value==='variable'?'Variable':value)+' de aliados');if(value==='0')control.title='Cero, guion o valor ausente en el catálogo';options.append(control);
    }box.append(row);
  }
}
function galleryCard(c,origin,footer){
  const root=canonical(c,cards),quantity=familyQuantity(root),card=el('article',undefined,'card'+(quantity?' selected':''));
  card.dataset.code=c.code;card.dataset.family=root;
  if(c.links.other_face||c.backImage){const flip=button('↻',()=>cardDetail(c.code,true,origin),'flip card-flip');flip.setAttribute('aria-label','Ver otra cara de '+title(c));card.append(flip);}
  const imageButton=button('',()=>cardDetail(c.code,false,origin),'card-image');imageButton.setAttribute('aria-label','Ver '+title(c));
  attachHover(imageButton,c.code,origin);
  if(c.image){const img=el('img');img.src=c.image;img.loading='lazy';img.decoding='async';img.alt=title(c);img.onerror=()=>{img.replaceWith(el('span','Imagen no disponible'));};imageButton.append(img);}else imageButton.append(el('span',title(c)));
  const name=el('h3',title(c),'card-title');attachHover(name,c.code,origin);
  card.append(imageButton,name);
  if(origin==='gallery'&&quantity)card.append(el('span',quantity+' en el mazo','mobile-only card-deck-quantity'));
  card.append(footer);
  return card;
}
function renderDeckDetail(){
  if($('deck-detail').hidden)return;
  const gallery=$('deck-detail-gallery'),hideHero=$('deck-hide-hero').checked;
  const splitRows=$('detail-group-rows').getAttribute('aria-pressed')==='true';
  gallery.replaceChildren();
  for(const group of listDeckGroups(deck,cards)){
    if(group.kind==='auxiliary')continue;
    const entries=group.codes.map(code=>selectedArtwork(code,deck,cards))
      .filter(c=>c&&(!hideHero||c.en.faction_code!=='hero'))
      .sort((a,b)=>title(a).localeCompare(title(b),'es'));
    if(!entries.length)continue;
    if(splitRows&&gallery.childElementCount)gallery.append(el('hr',undefined,'deck-group-separator'));
    for(const c of entries){
      const footer=el('div',undefined,'card-footer');
      footer.append(el('span',familyQuantity(canonical(c,cards))+'×','badge'));
      gallery.append(galleryCard(c,'deck-detail',footer));
    }
  }
  if(!gallery.childElementCount)gallery.append(el('p','No hay cartas del mazo para mostrar.','empty'));
}
function renderCatalogToolbar(filter){
  const summary=$('active-filter-summary');
  const focused=document.activeElement?.dataset.filterChip;
  summary.replaceChildren();
  const chip=(key,label,remove)=>{
    const control=button(label+' ×',()=>{remove();page=1;renderEditedFilter();},'active-filter-chip');
    control.dataset.filterChip=key;
    control.setAttribute('aria-label','Quitar filtro '+label);
    summary.append(control);
  };
  $('sort-summary').textContent=['sort','sort-secondary','sort-tertiary']
    .map(id=>$(id)).filter(control=>control.value).map(control=>control.selectedOptions[0].textContent).join(' → ');
  if(filter.search.trim())chip('search',filter.search.trim(),()=>{$('search').value='';});
  for(const [key,label] of [['type','Tipo'],['faction','Aspecto'],['cost','Coste'],['resource','Recurso']]){
    const controls=[...$(key+'-filter').querySelectorAll('[data-filter-value]:not(:disabled)')];
    const selected=controls.filter(control=>control.getAttribute('aria-pressed')==='true');
    if(selected.length===controls.length)continue;
    const names=selected.map(control=>control.getAttribute('aria-label')||control.textContent);
    chip(key,label+' · '+(names.length===0?'Ninguno':names.length<=2?names.join(', '):names.length+' seleccionados'),()=>{
      selection[key]=new Set(controls.map(control=>control.dataset.filterValue));
      single[key]=false;
      if(key==='faction')renderFactionFilter();
      else checklist(key,key==='cost'?costOptions:Object.entries(key==='type'?types:resources));
    });
  }
  if(filter.heroTraitInteraction)chip('hero-traits','Interacción rasgos mazo héroe',()=>$('hero-trait-interaction').click());
  for(const trait of filter.advancedTraits?selectedTraits:[])chip('trait-'+trait,trait,()=>{selectedTraits=selectedTraits.filter(value=>value!==trait);});
  if(filter.owned)chip('owned','Solo mi colección',()=>$('owned-only').click());
  if(!filter.hideHero)chip('hero','Cartas de héroes',()=>{$('hide-hero').click();});
  if(!filter.sameAspect)chip('aspect','Otros aspectos del héroe',()=>{$('same-aspect').click();});
  if(allyFilter.enabled)chip('allies','Estadísticas de aliados',()=>{$('advanced-allies').click();});
  if(filter.language!=='es')chip('language',filter.language==='en'?'Inglés':'Ambos idiomas',()=>{$('search-language').value='es';});
  if(otherPressed('show-variants'))chip('variants','Variantes',()=>{$('show-variants').click();});
  if(advancedFilters&&$('only-pinned').checked)chip('pinned','Solo fijados',()=>{$('only-pinned').click();});
  summary.hidden=!summary.childElementCount;
  if(focused){
    const target=[...summary.children].find(control=>control.dataset.filterChip===focused);
    (target||$('catalog-filters')).focus({preventScroll:true});
  }
}
function renderGallery(){
  clearTimeout(searchTimer);searchTimer=null;
  hideHover();
  captureActivePreset();
  renderAllyFilters();
  const filter=getFilter(),logical=advancedFilters&&presetsReady?presetResults(choices,presets,deck,collection,filter):filterCards(choices,filter,deck,collection),found=galleryArtworks(logical,deck,cards,otherPressed('show-variants'));
  renderCatalogToolbar(filter);
  availableRecords=logical;renderTraits();
  if($('gallery').clientWidth>0){const tracks=getComputedStyle($('gallery')).gridTemplateColumns;if(tracks&&tracks!=='none')galleryColumns=Math.max(1,tracks.split(/\s+/).length);}
  const selectedRoots=new Set(Object.entries(deck.cards).filter(([,n])=>n>0).map(([code])=>canonical(cards[code],cards)));
  const selectedCodes=new Set(found.filter(c=>selectedRoots.has(canonical(c,cards))).map(c=>c.code));
  const result=paginateCards(found,{rows:rowLimit,columns:galleryColumns,page,selectedFirst,selectedCodes});page=result.page;
  galleryDetailCodes=paginateCards(found,{rows:0,selectedFirst,selectedCodes}).items.map(c=>c.code);
  $('result-count').textContent=`${result.total} cartas · ${result.items.length} visibles`;
  $('mobile-filter-results').textContent=`Ver ${result.total} ${result.total===1?'carta':'cartas'}`;
  $('gallery-pagination').hidden=rowLimit===0;
  $('page-indicator').textContent=`${result.page} / ${result.pages}`;$('page-prev').disabled=page===1;$('page-next').disabled=page===result.pages;
  $('group-selection').setAttribute('aria-pressed',String(selectedFirst));$('row-limit-label').textContent=rowLimit===0?'Sin límite':'';
  $('gallery').replaceChildren();
  for(const c of result.items){
    const footer=el('div',undefined,'card-footer');footer.append(quantityControl(c));if(advancedFilters)footer.append(pinControls(c));
    $('gallery').append(galleryCard(c,'gallery',footer));
  }
  if(!found.length)$('gallery').append(el('p',advancedFilters&&presets.every(p=>!p.enabled)?'Todos los filtros están ocultos. Activa un ojo para mostrar sus cartas.':'No hay cartas con estos filtros. Prueba a limpiar la búsqueda.','empty'));
  renderDetailTools();
}
function groupPreferences(code){
  const field=el('fieldset',undefined,'group-preferences');field.append(el('legend','Agrupadores'));
  const current=deck.auxiliaries?.[code]?AUXILIARY_GROUP:deck.grouping.preferred[code]||'default';
  const natural=defaultGroup(cards[code],deck.grouping.mode);
  const inDeck=familyQuantity(code)>0;
  const entries=[{id:'default',name:'Default · '+natural.label},...deck.groups.filter(g=>g.codes.includes(code)||(inDeck&&!g.hidden)),{id:AUXILIARY_GROUP,name:'Auxiliares'}];
  for(const entry of entries){
    const label=el('label',undefined,'check-row'),radio=el('input');
    radio.type='radio';radio.name='preferred-group';radio.value=entry.id;radio.checked=current===entry.id;
    radio.disabled=readOnly||!$('library-view').hidden||Boolean(entry.hidden);
    if(entry.id===AUXILIARY_GROUP&&(requiredHeroCards(deck,cards)[code]||(!deck.cards[code]&&!deck.auxiliaries?.[code])))radio.disabled=true;
    radio.onchange=()=>{
      if(entry.id===AUXILIARY_GROUP||deck.auxiliaries?.[code]||(entry.codes&&!entry.codes.includes(code))){
        moveCard(code,entry.id==='default'?natural.id:entry.id);
      }else{
        deck.grouping.preferred[code]=entry.id;
        changed();
      }
      if(detailCode&&$('modal').open)cardDetail(detailCode,detailBack,detailNavigation);
    };
    label.append(radio,document.createTextNode(entry.name+(entry.hidden?' (oculto)':'')));field.append(label);
  }
  field.append(el('p','El grupo preferido determina dónde aparece la carta. Cambiarlo conserva sus otras asociaciones.','hint'));
  return field;
}
function canDrop(code,id){
  if(readOnly||!cards[code]||cards[code].role!=='deck_card'||automaticAuxiliaries(deck,cards)[code]||(!deck.cards[code]&&!deck.auxiliaries?.[code]))return false;
  if(id===AUXILIARY_GROUP)return !deck.auxiliaries?.[code]&&!requiredHeroCards(deck,cards)[code];
  return deck.groups.some(g=>g.id===id&&!g.hidden)||(defaultGroup(cards[code],deck.grouping.mode).id===id&&!deck.grouping.hiddenDefaults.includes(id));
}
function markMovingCard(code){for(const row of $('deck-list').querySelectorAll('.deck-row')){const selected=row.dataset.code===code;row.classList.toggle('moving-card',selected);row.querySelector('.drag-handle')?.setAttribute('aria-pressed',String(selected));}}
function finishDrag(){draggingCard='';markMovingCard('');document.body.classList.remove('dragging');for(const node of document.querySelectorAll('.drop-target'))node.classList.remove('drop-target');}
function moveCard(code,target){
  try{if(readOnly)return;moveToGroup(deck,code,target,cards);changed();}catch(e){report(e);}finally{finishDrag();}
}
function moveMenu(code){
  if(readOnly)return;markMovingCard(code);const body=el('div',undefined,'group-targets');body.append(el('p','Mover cambia el grupo preferido y conserva las asociaciones anteriores.'));
  const targets=listDeckGroups(deck,cards);if(!targets.some(g=>g.id===AUXILIARY_GROUP))targets.push({id:AUXILIARY_GROUP,label:'Auxiliares'});const natural=defaultGroup(cards[code],deck.grouping.mode);if(!targets.some(g=>g.id===natural.id))targets.push(natural);
  for(const group of targets.filter(g=>canDrop(code,g.id)))body.append(button(group.label,()=>{moveCard(code,group.id);$('modal').close();}));
  popup('Mover: '+title(cards[code]),body);
}
function dragHandle(code){
  const handle=button('☰',()=>moveMenu(code),'drag-handle');handle.setAttribute('aria-label','Mover '+title(cards[code])+' a otro grupo');handle.title='Arrastrar a un grupo o pulsar para elegir destino';handle.draggable=false;
  let touch=null,suppressClick=false;
  handle.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}},true);
  handle.onpointerdown=e=>{if(e.button!==0)return;markMovingCard(code);touch={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};handle.setPointerCapture(e.pointerId);};
  handle.onpointermove=e=>{if(!touch||touch.id!==e.pointerId)return;if(Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>8)touch.moved=true;if(!touch.moved)return;draggingCard=code;document.body.classList.add('dragging');
    for(const node of document.querySelectorAll('.drop-target'))node.classList.remove('drop-target');const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-group-id]');if(target&&canDrop(code,target.dataset.groupId))target.classList.add('drop-target');};
  handle.onpointerup=e=>{if(!touch||touch.id!==e.pointerId)return;const moved=touch.moved;touch=null;if(moved){suppressClick=true;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-group-id]');if(target&&canDrop(code,target.dataset.groupId))moveCard(code,target.dataset.groupId);finishDrag();}};
  handle.onpointercancel=()=>{touch=null;finishDrag();};return handle;
}
function defaultLabel(id){const [,mode,value]=id.split(':');return defaultGroup({en:{type_code:value,faction_code:value,cost:mode==='cost'?(value==='x'?-1:value==='unknown'?undefined:Number(value)):undefined}},mode).label;}
function renderHiddenGroups(){
  $('groups-list').replaceChildren();
  if(!Object.keys(auxiliaryCards(deck,cards)).length){const slot=el('span',undefined,'restore-group auxiliary-slot');slot.dataset.groupId=AUXILIARY_GROUP;const control=button('Auxiliares (reservado)',()=>{status('Arrastra una carta a Auxiliares o usa su asa para elegir este destino.');});control.title='Destino reservado para cartas auxiliares';slot.append(control);$('groups-list').append(slot);}
  const hidden=[...deck.grouping.hiddenDefaults.map(id=>({id,name:defaultLabel(id),kind:'default'})),...deck.groups.filter(g=>g.hidden).map(g=>({...g,kind:'custom'}))];
  if(hidden.length)$('groups-list').append(el('p','Grupos ocultos · Pulsa el nombre para restaurar.','hint'));
  for(const g of hidden){const chip=el('span',undefined,'restore-group');chip.append(button(g.name,()=>{pendingGroupDelete=null;restoreGroup(deck,g.id);changed();}));
    if(g.kind==='custom'){
      const armed=pendingGroupDelete?.deck===deck.id&&pendingGroupDelete?.group===g.id;
      const remove=button('×',()=>{if(armed){deleteCustomGroup(deck,g.id);pendingGroupDelete=null;changed();}else{pendingGroupDelete={deck:deck.id,group:g.id};renderHiddenGroups();}},'restore-delete'+(armed?' armed-delete':''));
      remove.setAttribute('aria-label',(armed?'Confirmar eliminación de ':'Eliminar definitivamente ')+g.name);remove.title=armed?'Pulsa otra vez para eliminar el grupo y sus asociaciones':'Eliminar definitivamente';chip.append(remove);
    }$('groups-list').append(chip);
  }
}
function renderDeck(){
  renderSaveChanges();
  hideHover();
  renderDeckDetail();
  $('deck-name').value=deck.name;$('notes').value=deck.notes;
  for(const o of $('aspect-select').options)o.selected=(pendingAspects||deck.aspects).includes(o.value);
  $('confirm-aspects').hidden=pendingAspects===null;
  const aux=auxiliaryCards(deck,cards),auxCount=Object.values(aux).reduce((s,n)=>s+n,0),report=constructionReport(deck,cards);
  const count=Object.values(deck.cards).reduce((s,n)=>s+n,0);$('deck-count').textContent=String(count)+(auxCount?` + ${auxCount} auxiliares`:'');
  $('mobile-deck-count').textContent=String(count);
  $('empty-deck-actions').hidden=readOnly||Boolean(count);
  $('deck-view-name').textContent=deck.name;
  const meta=$('deck-view-meta');meta.replaceChildren();
  if(cards[deck.hero]){
    const identity=el('span',undefined,'deck-identity');
    const heroName=button(title(cards[deck.hero]),()=>cardDetail(deck.hero),'hero-name');
    heroName.id='deck-hero-name';attachHover(heroName,deck.hero,'identity');identity.append(heroName);
    for(const card of identityPreviewCards(cards[deck.hero],cards)){
      if(!card.image)continue;
      const thumb=button('',()=>cardDetail(card.code),'deck-thumb');
      const face=card.en.type_code==='alter_ego'?'alter ego':'héroe';
      thumb.setAttribute('aria-label',`Ver ${face} · ${title(card)}`);
      const image=previewImage(card,card.image);image.alt='';
      attachHover(thumb,deck.hero,'identity');
      thumb.append(image);identity.append(thumb);
    }
    meta.append(identity);
  }else meta.append(document.createTextNode('Sin héroe'));
  const aspects=deck.aspects.map(a=>factions[a]||a).join(' / ');
  const aspectLabel=aspects||readOnly
    ? el('span',aspects||'Sin aspecto')
    : button('Selecciona el aspecto',()=>{
      if($('deck-panel').hidden)$('deck-tab').click();
      $('aspect-select').focus();
    },'aspect-prompt');
  meta.append(document.createTextNode(' · '),aspectLabel,document.createTextNode(' · '+[
    `${count} cartas`+(auxCount?` + ${auxCount} cartas auxiliares`:''),
    deck.versions.at(-1)?'Versión '+deck.versions.at(-1).label:'Borrador',
  ].join(' · ')));
  $('clean-deck').hidden=readOnly||!report.removable.length;$('undo-clean-deck').hidden=readOnly||!cleanupUndo||cleanupUndo.id!==deck.id||cleanupUndo.after!==JSON.stringify(deck);
  const summary={};for(const [code,n]of Object.entries(deck.cards)){const t=types[cards[code]?.en.type_code]||'Otra';summary[t]=(summary[t]||0)+n;}
  $('deck-summary').textContent=Object.entries(summary).map(([k,n])=>`${n} ${k.toLowerCase()}`).join(' · ')||'Elige un héroe o añade tu primera carta.';
  $('deck-list').replaceChildren();
  const minimum=requiredHeroCards(deck,cards);
  $('grouping-mode').value=$('detail-grouping-mode').value=deck.grouping.mode;
  for(const descriptor of listDeckGroups(deck,cards)){
    const isAux=descriptor.kind==='auxiliary';
    const entries=descriptor.codes.filter(code=>isAux||!$('deck-hide-hero').checked||cards[code].en.faction_code!=='hero').map(code=>[code,isAux?aux[code]:deck.cards[code]]).sort(([a],[b])=>title(cards[a]).localeCompare(title(cards[b]),'es'));
    if(!entries.length&&$('deck-hide-hero').checked&&descriptor.codes.length)continue;
    const group=el('section',undefined,'deck-type');group.dataset.groupId=descriptor.id;
    const heading=el('div',undefined,'group-heading');heading.append(el('h3',`${descriptor.label} (${entries.reduce((sum,[,n])=>sum+n,0)})`));
    if(!readOnly&&descriptor.kind==='custom'){const clear=button('Limpiar',()=>{clearCustomGroup(deck,descriptor.id);changed();status('Grupo «'+descriptor.label+'» sin asociaciones. Las cartas permanecen en el mazo.');},'clear-group');clear.setAttribute('aria-label','Limpiar grupo '+descriptor.label);clear.title='Desasociar todas sus cartas sin quitarlas del mazo';clear.disabled=!deck.groups.find(g=>g.id===descriptor.id)?.codes.length;heading.append(clear);}
    if(!readOnly&&!isAux&&descriptor.kind!=='ungrouped'){const hide=button('×',()=>{hideGroup(deck,descriptor.id);pendingGroupDelete=null;changed();},'hide-group');hide.setAttribute('aria-label','Ocultar grupo '+descriptor.label);heading.append(hide);}group.append(heading);
    if(!readOnly&&descriptor.kind!=='ungrouped'){
      group.ondragover=e=>{if(canDrop(draggingCard,descriptor.id)){e.preventDefault();e.dataTransfer.dropEffect='move';group.classList.add('drop-target');}};
      group.ondragleave=e=>{if(!group.contains(e.relatedTarget))group.classList.remove('drop-target');};
      group.ondrop=e=>{e.preventDefault();const code=draggingCard||e.dataTransfer.getData('text/x-marvel-card');if(canDrop(code,descriptor.id))moveCard(code,descriptor.id);finishDrag();};
    }
    for(const [code,n]of entries){
      const c=cards[code],root=canonical(c,cards),art=isAux&&c.role==='hero_auxiliary'?c:selectedArtwork(root,deck,cards),row=el('div',undefined,'deck-row');row.dataset.code=code;row.dataset.detailCode=art.code;
      const dot=el('span',undefined,'faction-dot');dot.dataset.faction=c.en.faction_code;dot.title=factions[c.en.faction_code];dot.setAttribute('aria-label',factions[c.en.faction_code]);
      if(c.en.faction_code==='hero'){dot.classList.add('hero-emblem');dot.append(iconSvg('hero'));}
      const nameButton=button(title(c),()=>cardDetail(art.code,false,'deck'),'text-button');attachHover(nameButton,art.code);row.append(el('span',n+'×','copy-count'),dot,nameButton);
      const violation=!isAux&&report.byCard[root];if(violation){row.classList.add('incompatible');nameButton.title=violation.messages.join(' ');nameButton.setAttribute('aria-label',title(c)+' · Revisar compatibilidad');}
      const resources=el('span',undefined,'resources');
      for(const [key,name]of [['energy','Energía'],['physical','Físico'],['mental','Mental'],['wild','Universal']])for(let i=0;i<(c.en['resource_'+key]||0);i++){const icon=el('span',undefined,'resource');icon.dataset.resource=key;icon.title=name;icon.setAttribute('aria-label',name);icon.append(iconSvg(key));resources.append(icon);}
      row.append(resources);
      if(art.image){const thumb=button('',()=>cardDetail(art.code,false,'deck'),'deck-thumb');thumb.setAttribute('aria-label','Ver miniatura de '+title(c));const img=el('img');img.src=art.image;img.alt='';img.loading='lazy';thumb.append(img);row.append(thumb);}
      if(!readOnly){const fixed=isAux?automaticAuxiliaries(deck,cards)[code]:minimum[root];if(!isAux||!fixed){const tools=el('span',undefined,'row-actions');tools.append(dragHandle(code));row.append(tools);}}
      group.append(row);
    }
    $('deck-list').append(group);
  }
  const issues=[];
  for(const [code,n]of Object.entries(deck.cards)){
    const c=cards[code];if(!c)continue;
    if(familyQuantity(canonical(c,cards))>limit(c))issues.push(title(c)+': excede el límite del constructor.');
  }
  const warn=el('div',undefined,'warnings');for(const message of [...new Set(issues)])warn.append(el('p',message));
  for(const message of report.issues)warn.append(el('p',message,'construction-issue'));
  if(deck.hero){
    const set=cards[deck.hero].links.set;
    const missing=choices.filter(c=>c.en.faction_code==='hero'&&c.links.set===set&&familyQuantity(c.code)<c.en.quantity);
    if(missing.length)warn.append(el('p',`${missing.length} cartas del conjunto del héroe tienen menos copias que las indicadas en su producto.`, 'muted'));
  }
  warn.append(el('p','Se revisan aspectos, límites de copias y reglas de construcción de las identidades. Las condiciones de juego y otras excepciones no están evaluadas.','muted'));warn.classList.add('deck-type');$('deck-list').append(warn);
  renderHiddenGroups();
  renderFactionFilter();renderTraits();renderStatistics();renderSimulation();
}
function renderSimulation(){
  const signature=JSON.stringify([deck.id,deck.hero,Object.entries(deck.cards).sort(([a],[b])=>a.localeCompare(b))]);
  if(signature!==simulationKey){simulationKey=signature;simulation=new DrawSimulator(deck.cards);simulationNotice='';}
  const sizes=printedHandSizes(cards[deck.hero],cards);$('sim-draw-hero').textContent='Mano héroe'+(sizes.hero?' ('+sizes.hero+')':'');$('sim-draw-hero').disabled=!sizes.hero||!simulation.pile.length;$('sim-draw-alter').textContent='Mano alter ego'+(sizes.alter?' ('+sizes.alter+')':'');$('sim-draw-alter').disabled=!sizes.alter||!simulation.pile.length;
  for(const id of ['sim-draw-one','sim-draw-two','sim-draw-six'])$(id).disabled=!simulation.pile.length;
  for(const id of ['sim-redraw','sim-return'])$(id).disabled=!simulation.selected.size;
  $('sim-status').textContent=simulation.hand.length+' en mano · '+simulation.pile.length+' en mazo · '+simulation.selected.size+' seleccionadas'+(simulationNotice?' · '+simulationNotice:'');
  $('sim-hand').replaceChildren();for(const instance of simulation.hand){const c=cards[instance.code],art=selectedArtwork(canonical(c,cards),deck,cards)||c,control=button('',()=>{simulation.toggle(instance.id);simulationNotice='';renderSimulation();},'sim-card');control.setAttribute('aria-label',title(c)+' · seleccionar copia '+instance.id);control.setAttribute('aria-pressed',String(simulation.selected.has(instance.id)));if(art.image){const img=el('img');img.src=art.image;img.alt=title(c);control.append(img);}control.append(el('span',title(c)));$('sim-hand').append(control);}
  if(!simulation.hand.length)$('sim-hand').append(el('p','Roba cartas para comenzar. Los auxiliares no forman parte de este mazo.','hint'));
}
function simulateDraw(count){const drawn=simulation.draw(count);simulationNotice='Robadas '+drawn+(drawn<count?' de '+count+' solicitadas':'');renderSimulation();}
function render(){renderDeck();renderGallery();if(!$('library-view').hidden)renderLibrary();}
function cleanDeck(){
  if(readOnly)return;const report=constructionReport(deck,cards),body=el('div');
  body.append(el('p','Selecciona qué cartas retirar del borrador. Auxiliares y cartas obligatorias están excluidos. La versión guardada se conserva hasta guardar una nueva versión.'));
  const selected=new Set(report.removable.filter(code=>report.byCard[code].direct));
  for(const code of report.removable){const label=el('label',undefined,'check-row'),input=el('input');input.type='checkbox';input.checked=selected.has(code);input.onchange=()=>{if(input.checked)selected.add(code);else selected.delete(code);};label.append(input,document.createTextNode(title(cards[code])+' · '+report.byCard[code].messages.join(' ')));body.append(label);}
  for(const message of report.issues)body.append(el('p',message,'hint'));
  body.append(button('Retirar seleccionadas',()=>{if(!selected.size){status('Selecciona las cartas que deseas retirar.');return;}const before=clone(deck);removeConstructionCards(deck,[...selected],cards);cleanupUndo={id:deck.id,before,after:JSON.stringify(deck)};changed();$('modal').close();},'primary'));popup('Limpiar Mazo',body);
}
function renderStatistics(){
  const stats=deckStatistics(deck,cards),container=$('deck-statistics-content');container.replaceChildren();
  container.append(el('p',stats.count+' cartas · '+stats.totalResources+' símbolos impresos · '+stats.resourcesPerCard.toLocaleString('es-CL',{maximumFractionDigits:2})+' recursos por carta','hint'));
  const resourceSection=el('section',undefined,'stat-chart');resourceSection.append(el('h3','Recursos impresos'),el('p','Pulsa un recurso para ver cartas de uno, dos o más símbolos.','hint'));
  const columns=el('div',undefined,'stat-columns'),max=Math.max(1,...Object.values(stats.resources)),drill=el('div',undefined,'resource-drill');drill.hidden=true;
  for(const [key,n]of Object.entries(stats.resources)){
    const column=el('div',undefined,'stat-column'),bar=button('',()=>{drill.hidden=false;drill.replaceChildren(el('strong',resources[key]));for(const [symbols,copies]of Object.entries(stats.resourceCards[key]))drill.append(el('p',symbols+' símbolos: '+copies+' cartas'));if(!Object.keys(stats.resourceCards[key]).length)drill.append(el('p','Sin cartas con este recurso.'));},'stat-stack');
    bar.setAttribute('aria-label',resources[key]+': '+n+' símbolos, '+stats.heroResources[key]+' del conjunto de héroe');bar.title=bar.getAttribute('aria-label');
    for(const [amount,hero]of [[n-stats.heroResources[key],false],[stats.heroResources[key],true]]){const fill=el('span',undefined,hero?'stat-hero':'');fill.dataset.stat=key;fill.style.height=(100*amount/max)+'%';bar.append(fill);}
    const label=el('span',undefined,'stat-icon');label.append(iconSvg(key),document.createTextNode(resources[key]));column.append(el('strong',String(n)),bar,label);columns.append(column);
  }
  resourceSection.append(columns,el('p','Trama: símbolos del conjunto de héroe. Color liso: resto del mazo.','hint'),drill);container.append(resourceSection);
  const cost=el('section',undefined,'stat-chart');cost.append(el('h3','Coste de cartas'),el('p','Costes X y sin coste excluidos de la curva ('+stats.ignoredCosts+' cartas).','hint'));
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 340 170');svg.setAttribute('role','img');svg.setAttribute('aria-label','Curva de coste: '+stats.costs.map(([label,n])=>label+': '+n).join(', '));svg.classList.add('cost-chart');
  const costMax=Math.max(1,...stats.costs.map(([,n])=>n)),points=stats.costs.map(([,n],i)=>[25+(stats.costs.length>1?290*i/(stats.costs.length-1):145),140-115*n/costMax]);
  const line=document.createElementNS(ns,'polyline');line.setAttribute('points',points.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#84b7f4');line.setAttribute('stroke-width','2');svg.append(line);
  for(const [i,[x,y]]of points.entries()){const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','3');circle.setAttribute('fill','#b2d4ff');svg.append(circle);for(const [text,ty]of [[stats.costs[i][0],160],[String(stats.costs[i][1]),Math.max(14,y-9)]]){const label=document.createElementNS(ns,'text');label.setAttribute('x',x);label.setAttribute('y',ty);label.setAttribute('text-anchor','middle');label.textContent=text;svg.append(label);}}
  cost.append(svg);container.append(cost);
  const aspect=el('section',undefined,'stat-chart');aspect.append(el('h3','Aspectos'));const factionColumns=el('div',undefined,'stat-columns'),maxFaction=Math.max(1,...Object.values(stats.factions));
  for(const [key,n]of Object.entries(stats.factions)){const col=el('div',undefined,'stat-column'),track=el('div',undefined,'stat-stack'),fill=el('span');fill.style.height=(100*n/maxFaction)+'%';fill.dataset.stat=key;track.append(fill);col.append(el('strong',String(n)),track,el('span',factions[key]||key,'stat-label'));factionColumns.append(col);}aspect.append(factionColumns);container.append(aspect);
}

function versions(){
  const body=el('div');const pending=deck.versions.at(-1);
  if(!pending)body.append(el('p','Todavía no guardaste una versión. La primera mostrará todas las cartas añadidas.'));
  for(const [index,v]of [...deck.versions.entries()].reverse()){
    const section=el('section',undefined,'version');section.append(el('h3',v.label),el('p',new Date(v.date).toLocaleString('es-CL'),'muted'));
    section.append(el('small',index?'Respecto de '+deck.versions[index-1].label:'Contenido inicial'));
    if(!v.diff.added.length&&!v.diff.removed.length)section.append(el('p','Sin cambios de cartas del mazo principal. Puede haber ajustes de auxiliares, nombre, grupos o notas.'));
    for(const x of v.diff.removed)section.append(el('p',`− ${x.quantity} × ${title(cards[x.code])}`,'delta-removed'));
    for(const x of v.diff.added)section.append(el('p',`+ ${x.quantity} × ${title(cards[x.code])}`,'delta-added'));
    section.append(button('Ver listado completo',()=>{const content=el('div');for(const [code,n]of Object.entries(v.snapshot.cards))content.append(el('p',`${n} × ${title(cards[code])}`));const aux=Object.entries(auxiliaryCards(v.snapshot,cards));if(aux.length){content.append(el('h3','Auxiliares'));for(const [code,n]of aux)content.append(el('p',`${n} × ${title(cards[code])}`));}content.append(button('Volver al historial',versions));popup(v.label,content);}));
    section.append(button('Abrir como copia',()=>{duplicate({...v.snapshot,versions:deck.versions.slice(0,index+1)});$('modal').close();}));body.append(section);
  }
  popup('Versiones de '+deck.name,body);
}
function library(){
  showView('library');
}
function renderLibrary(){
  const saved=store.list().map(x=>x.deck),heroValue=$('library-hero').value;
  if(armedOnly)for(const d of saved.filter(d=>d.armed))retainedArmed.add(d.id);
  $('library-hero').replaceChildren(option('','Todos los héroes'));
  const identities=[...new Set(saved.map(d=>d.hero).filter(Boolean))].sort((a,b)=>title(cards[a]).localeCompare(title(cards[b]),'es'));
  for(const code of identities)$('library-hero').append(option(code,title(cards[code])));$('library-hero').value=identities.includes(heroValue)?heroValue:'';
  $('library-armed').setAttribute('aria-pressed',String(armedOnly));$('shortages-panel').hidden=!armedOnly;
  const visible=filterDecks(saved,{hero:$('library-hero').value,aspect:$('library-aspect').value,armedOnly,retained:retainedArmed,...librarySort},cards);
  $('library-list').replaceChildren();
  for(const d of visible){
    const row=el('tr');row.dataset.id=d.id;
    const name=el('td');const info=el('div',undefined,'library-name');
    if(cards[d.hero]?.image){const img=el('img');img.src=cards[d.hero].image;img.alt='';img.loading='lazy';img.className='library-thumb';info.append(img);}
    info.append(button(d.name,()=>openSaved(store.load(d.id),true),'library-deck-name'));name.append(info);row.append(name);
    const hero=cards[d.hero]?title(cards[d.hero]):'Sin héroe';
    const aspect=d.aspects.map(a=>factions[a]||a).join(' / ')||'—';
    const version=d.versions.at(-1)?.label||'—';
    const count=Object.values(d.cards).reduce((sum,n)=>sum+n,0);
    name.append(el('small',`${hero} · ${aspect} · v${version} · ${count} cartas`,'library-mobile-meta'));
    for(const value of [hero,aspect,version,String(count)])row.append(el('td',value));
    const armCell=el('td'),arm=el('input');arm.type='checkbox';arm.checked=d.armed;arm.setAttribute('aria-label','Mazo armado: '+d.name);arm.onchange=()=>setArmed(d.id,arm.checked);armCell.append(arm);if(armedOnly&&!d.armed)armCell.append(el('small','Desmarcado en esta vista','muted'));row.append(armCell);
    const actions=el('td'),tools=el('div',undefined,'toolbar');
    tools.append(button('Ver',()=>openSaved(store.load(d.id),true)),button('Editar',()=>openSaved(store.load(d.id))),button('Duplicar',()=>duplicate(store.load(d.id).deck)));
    const exportAction=button('Exportar',()=>exportDeck(d));
    exportAction.setAttribute('aria-label','Exportar mazo '+d.name);
    tools.append(exportAction);
    const link=el('a','↗');link.href='?deck='+encodeURIComponent(d.id);link.target='_blank';link.rel='noopener';link.title='Editar en otra pestaña';link.setAttribute('aria-label','Editar '+d.name+' en otra pestaña');tools.append(link);actions.append(tools);row.append(actions);$('library-list').append(row);
  }
  if(!visible.length){const row=el('tr'),cell=el('td','No hay mazos guardados con estos filtros. Guarda una versión o recupera un borrador.','empty');cell.colSpan=7;row.append(cell);$('library-list').append(row);}
  for(const control of document.querySelectorAll('[data-sort]')){
    const key=control.dataset.sort,active=key===librarySort.sortKey?librarySort.direction:0;
    const label={name:'Nombre',hero:'Héroe',aspects:'Aspectos',version:'Versión',count:'Cartas',armed:'Armado'}[key];
    control.textContent=label+' '+(active===1?'↑':active===-1?'↓':'↕');control.closest('th').setAttribute('aria-sort',active===1?'ascending':active===-1?'descending':'none');
  }
  $('library-mobile-sort').value=librarySort.sortKey&&librarySort.direction
    ? librarySort.sortKey+':'+librarySort.direction : '';
  $('shortages-list').replaceChildren();
  for(const s of shortage(saved,cards,collection)){
    const section=el('section',undefined,'shortage-row');
    if(cards[s.code].image){const img=el('img');img.src=cards[s.code].image;img.alt='';img.loading='lazy';img.className='shortage-thumb';section.append(img);}
    const text=el('div');text.append(button(title(cards[s.code]),()=>cardDetail(s.code),'text-button'),el('p',`Necesarias: ${s.quantity} · Disponibles: ${s.available} · Faltan: ${s.missing}`,'delta-removed'));
    for(const usage of s.decks)text.append(el('p',`${usage.name}: ${usage.quantity} copias`,'muted'));section.append(text);$('shortages-list').append(section);
  }
  if(!$('shortages-list').childElementCount)$('shortages-list').append(el('p','No hay faltantes entre los mazos armados según los productos de tu colección.','empty'));
  const recoveries=new Map();
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key.startsWith('marvel.recovery.'))continue;
    try{const d=JSON.parse(localStorage.getItem(key));if(d?.dirty&&(!recoveries.has(d.deck.id)||d.updated>recoveries.get(d.deck.id).updated))recoveries.set(d.deck.id,d);}catch{}
  }
  for(const d of drafts().filter(r=>r.dirty||r.revision===null))if(!recoveries.has(d.deck.id)||d.updated>=recoveries.get(d.deck.id).updated)recoveries.set(d.deck.id,d);
  $('recoveries-list').replaceChildren();
  for(const d of recoveries.values())$('recoveries-list').append(button(d.deck.name+' · '+new Date(d.updated).toLocaleString('es-CL'),()=>{showView('constructor');openDeck(d,false);changed(false);status('Borrador recuperado. Al guardar se comprobará su revisión.');}));
  if(!recoveries.size)$('recoveries-list').append(el('p','No hay borradores pendientes.','muted'));
}
async function setArmed(id,value){
  if(!navigator.locks){status('No se pudo cambiar el estado: el navegador no ofrece bloqueo entre pestañas.');renderLibrary();return;}
  try{
    const {previous,saved}=await navigator.locks.request('marvel.deck.'+id,()=>{const previous=store.load(id);if(!previous)throw Error('El mazo ya no está disponible.');const saved=store.save({...previous.deck,armed:value},previous.revision);return {previous,saved};});
    const key='marvel.draft.'+id;let pending;try{pending=JSON.parse(sessionStorage.getItem(key));}catch{}
    if(pending){pending.deck.armed=value;if(pending.revision===previous.revision)pending.revision=saved.revision;sessionStorage.setItem(key,JSON.stringify(pending));}
    if(deck?.id===id){deck.armed=value;if(revision===previous.revision)revision=saved.revision;if(!readOnly)saveDraft();}
    renderLibrary();status(value?'Mazo marcado como armado.':'Mazo desmarcado: sus cartas dejaron de contar.');
  }catch(e){report(e);renderLibrary();}
}
function collectionDialog(){
  const body=el('div',undefined,'collection-list');
  const toolbar=el('div',undefined,'collection-toolbar');
  const search=el('input');search.type='search';search.placeholder='Buscar producto…';search.setAttribute('aria-label','Buscar producto');
  const scope=el('select');scope.setAttribute('aria-label','Mostrar productos');
  scope.append(option('all','Todos'),option('owned','En mi colección'),option('missing','Pendientes'));
  const count=el('output',undefined,'collection-count');count.setAttribute('aria-live','polite');
  toolbar.append(search,scope,count,el('p','Cada producto marcado cuenta como una copia para Solo mi colección y para los faltantes de mazos armados.','hint'));
  const empty=el('p','No hay productos con esta búsqueda.','empty');
  const rows=catalog.packs.map(pack=>{
    const label=el('label',undefined,'check-row'),input=el('input');
    input.type='checkbox';input.checked=(collection[pack.code]??1)>0;
    input.onchange=()=>{
      try{
        const value=Number(input.checked);
        localStorage.setItem('marvel.product.'+pack.code,String(value));
        collection[pack.code]=value;
        update();renderGallery();
        if(!$('library-view').hidden)renderLibrary();
        if(label.hidden)scope.focus();
      }catch(e){input.checked=(collection[pack.code]??1)>0;report(e);}
    };
    label.append(input,document.createTextNode(pack.name));
    return {label,input,code:pack.code,name:normalize(pack.name)};
  });
  const byCode=new Map(rows.map(row=>[row.code,row]));
  const groupedCodes=new Set(collectionCycles.flatMap(([,codes])=>codes));
  const groups=[...collectionCycles,['Otros productos',rows.filter(row=>!groupedCodes.has(row.code)).map(row=>row.code)]]
    .map(([name,codes])=>{
      const products=codes.map(code=>byCode.get(code)).filter(Boolean);
      const panel=el('details',undefined,'collection-cycle'),heading=el('summary'),total=el('span',undefined,'collection-cycle-count');
      heading.append(el('strong',name),total);
      const list=el('div',undefined,'collection-cycle-products');list.append(...products.map(row=>row.label));
      panel.append(heading,list);
      return {panel,total,products};
    }).filter(group=>group.products.length);
  function update(reveal=false){
    const query=normalize(search.value.trim());
    let marked=0,visible=0;
    for(const {label,input,name} of rows){
      marked+=Number(input.checked);
      label.hidden=!name.includes(query)||(scope.value==='owned'&&!input.checked)||(scope.value==='missing'&&input.checked);
      visible+=Number(!label.hidden);
    }
    count.textContent=`${marked} de ${rows.length} marcados`;
    empty.hidden=Boolean(visible);
    for(const {panel,total,products} of groups){
      panel.hidden=products.every(row=>row.label.hidden);
      total.textContent=products.filter(row=>row.input.checked).length+' / '+products.length;
      if(reveal)panel.open=!panel.hidden&&Boolean(query||scope.value!=='all');
    }
  }
  search.oninput=()=>update(true);scope.onchange=()=>update(true);
  body.append(...groups.map(group=>group.panel),empty);update();
  popup('Mi colección',body);$('modal-body').prepend(toolbar);
}
function renderHeroOptions(){
  const name=card=>card[heroLanguage]?.name||title(card);
  const seen=new Set();
  const options=[...heroOptions].filter(([code,faces])=>{
    const key=cards[code].links.set||code;
    if(code!==faces[0].code||cards[code].en.hidden||seen.has(key))return false;
    seen.add(key);return true;
  })
    .map(([code,[hero,alter]])=>[code,name(hero)+(alter?' · '+name(alter):'')])
    .sort((a,b)=>a[1].localeCompare(b[1],heroLanguage));
  const current=$('hero-select').value;
  $('hero-select').replaceChildren(option('','Elegir héroe…'),...options.map(([code,label])=>option(code,label)));
  const control=$('hero-language');
  control.textContent=heroLanguage.toUpperCase();
  control.setAttribute('aria-label','Idioma de los nombres: '+(heroLanguage==='es'?'Español. Cambiar a inglés':'Inglés. Cambiar a español'));
  $('hero-select').value=current;
  updateNewDeckControls();
}
async function importFile(file,fromLibrary=false){
  if(!file)return;if(file.size>10*1024*1024){status('El archivo supera 10 MB.');return;}
  try{
    const incoming=validateImport(JSON.parse(await file.text()),cards);
    // Normalize equivalent printings and faces so imports cannot bypass family limits.
    for(const d of incoming){for(const content of [d,...d.versions.map(v=>v.snapshot)]){
      const normalized={};for(const [code,n]of Object.entries(content.cards)){const c=canonical(cards[code],cards);normalized[c]=(normalized[c]||0)+n;if(normalized[c]>99)throw Error('La familia de carta '+c+' supera 99 copias en el respaldo.');}content.cards=normalized;
      for(const g of content.groups)g.codes=[...new Set(g.codes.map(c=>canonical(cards[c],cards)))];
      const preferred={};for(const [code,target]of Object.entries(content.grouping.preferred)){const key=canonical(cards[code],cards);if(!Object.hasOwn(preferred,key))preferred[key]=target;}content.grouping.preferred=preferred;
    }
      let previous={};for(const v of d.versions){v.diff=diffCards(previous,v.snapshot.cards);previous=v.snapshot.cards;}
      d.restoredCopies=ensureHeroCards(d,cards);
    }
    const body=el('div');body.append(el('p',`Se importarán ${incoming.length} mazos como copias nuevas. No se reemplazarán los existentes.`));
    for(const d of incoming)body.append(el('p',`${d.name} · ${Object.values(d.cards).reduce((s,n)=>s+n,0)} cartas · ${d.versions.length} versiones`+(d.restoredCopies?` · Se completarán ${d.restoredCopies} copias obligatorias del héroe.`:'')));
    body.append(button('Importar copias',()=>{
      try{
        for(const d of incoming){delete d.restoredCopies;store.save(d,null);}
        if(fromLibrary)renderLibrary();
        else openDeck(store.load(incoming[0].id),false);
        $('modal').close();
        status('Copias importadas. Los originales se conservaron.');
      }catch(e){report(e);}
    }));popup('Revisar importación',body);
  }catch(e){report(e);}
}
async function init(){
  const response=await fetch('./catalog.json');if(!response.ok)throw Error('No se pudo cargar el catálogo. Ejecuta primero npm run gestor:preparar.');
  catalog=await response.json();cards=catalog.cards;store=new DeckStore(localStorage);
  const heroSets=new Set(Object.values(cards).filter(c=>c.role==='identity'&&c.links.set).map(c=>c.links.set));
  for(const card of Object.values(cards))if(heroSets.has(card.links.set))card.heroSetCard=true;
  playerTraits=uniqueTraits(Object.values(cards).filter(c=>['deck_card','identity','hero_auxiliary'].includes(c.role)).flatMap(c=>scopedTraits(c,undefined,true)));
  choices=Object.values(cards).filter(c=>c.role==='deck_card'&&!c.en.hidden&&canonical(c,cards)===c.code);allyOptions=allyStatOptions(choices);
  for(const p of catalog.packs){const raw=localStorage.getItem('marvel.product.'+p.code);if(raw!==null)collection[p.code]=Number(raw)>0?1:0;}
  for(const hero of Object.values(cards).filter(c=>c.role==='identity'&&c.en.type_code==='hero')){
    heroOptions.set(hero.code,identityPreviewCards(hero,cards));
  }
  renderHeroOptions();
  checklist('type',Object.entries(types));
  costOptions=[...new Set(choices.map(c=>c.en.cost).filter(n=>Number.isFinite(n)&&n!==-1))].sort((a,b)=>a-b).map(n=>[String(n),String(n)]);costOptions.push(['unknown','Sin coste']);if(choices.some(c=>c.en.cost===-1))costOptions.push(['-1','Variable']);
  selection.cost=new Set(costOptions.map(([code])=>code));checklist('cost',costOptions);
  checklist('resource',Object.entries(resources));
  const sortControls=['sort','sort-secondary','sort-tertiary'];
  for(const [index,id]of sortControls.entries()){
    $(id).replaceChildren();if(index)$(id).append(option('','Sin '+(index===1?'segundo':'tercer')+' criterio'));
    for(const [value,label]of Object.entries({faction:'Aspecto',type:'Tipo de carta',cost:'Coste',name:'Nombre'}))$(id).append(option(value,label));
    $(id).value=CARD_SORT_DEFAULTS[index];
  }
  $('search').addEventListener('input',event=>{
    clearTimeout(searchTimer);searchTimer=null;if(event.isComposing)return;
    if(advancedFilters&&currentPreset()?.enabled===false)captureActivePreset(true);
    searchTimer=setTimeout(()=>{searchTimer=null;page=1;renderGallery();},SEARCH_DELAY_MS);
  });
  $('search-language').addEventListener('change',()=>{page=1;renderEditedFilter();});
  for(const id of sortControls)$(id).addEventListener('change',()=>{page=1;renderGallery();});
  setOtherPressed('show-variants',localStorage.getItem('marvel.show-variants')==='true');
  for(const [id,key]of [['show-variants','marvel.show-variants'],['owned-only','marvel.filters.owned']]){
    $(id).onclick=()=>{setOtherPressed(id,!otherPressed(id));page=1;try{localStorage.setItem(key,String(otherPressed(id)));}catch{}renderGallery();};
  }
  for(const id of ['hide-hero','same-aspect'])$(id).onclick=()=>{setOtherPressed(id,!otherPressed(id));page=1;renderFactionFilter();renderEditedFilter();};
  $('advanced-allies').onclick=()=>{allyFilter.enabled=!allyFilter.enabled;page=1;renderEditedFilter();};
  $('trait-filter').oninput=()=>{traitSuggestionsOpen=true;renderTraits();};
  $('trait-filter').onfocus=()=>{if($('trait-filter').value.trim()){traitSuggestionsOpen=true;renderTraits();}};
  for(const id of ['trait-in-attribute','trait-in-text'])$(id).onchange=()=>{refreshTraitSources();page=1;renderEditedFilter();};refreshTraitSources();
  $('search-options-toggle').onclick=()=>toggleSearchOptions();
  document.addEventListener('click',e=>{if(!$('search-options').contains(e.target)&&!$('search-options-toggle').contains(e.target))toggleSearchOptions(false);});
  for(const id of ['search-name','search-text'])$(id).onchange=()=>{if(!$('search-name').checked&&!$('search-text').checked)$(id).checked=true;refreshSearchFields();page=1;renderEditedFilter();};refreshSearchFields();
  $('advanced-filters').onclick=()=>{captureActivePreset();advancedFilters=!advancedFilters;setOtherPressed('advanced-filters',advancedFilters);try{localStorage.setItem('marvel.filters.enabled',String(advancedFilters));}catch(e){report(e);}closePinPopover();renderFilterTabs();page=1;renderGallery();};
  $('preset-name').oninput=()=>{const name=$('preset-name').value;savePresetPatch(activePresetId,p=>{p.name=name;});renderFilterTabs();};
  $('only-pinned').onchange=()=>{const value=$('only-pinned').checked;savePresetPatch(activePresetId,p=>{p.onlyPinned=value;if(advancedFilters)p.enabled=true;});renderFilterTabs();page=1;renderGallery();};
  $('clear-preset-pins').onclick=()=>{const id=activePresetId;confirmPinClear('filter:'+id,$('clear-preset-pins'),()=>{savePresetPatch(id,p=>{p.pins=[];});closePinPopover();renderFilterTabs();renderGallery();});};
  document.addEventListener('click',e=>{if(!$('pin-popover').contains(e.target)&&!e.target.closest('.pin-button'))closePinPopover();});
  for(const [id,n]of [['sim-draw-one',1],['sim-draw-two',2],['sim-draw-six',6]])$(id).onclick=()=>simulateDraw(n);
  $('sim-draw-hero').onclick=()=>{const n=printedHandSizes(cards[deck.hero],cards).hero;if(n)simulateDraw(n);};
  $('sim-draw-alter').onclick=()=>{const n=printedHandSizes(cards[deck.hero],cards).alter;if(n)simulateDraw(n);};
  $('sim-redraw').onclick=()=>{const result=simulation.redrawSelected();simulationNotice='Reemplazadas '+result.replaced+' de '+result.requested+' seleccionadas';renderSimulation();};
  $('sim-return').onclick=()=>{const returned=simulation.returnSelected();simulationNotice='Devueltas '+returned+' y mazo barajado';renderSimulation();};
  $('sim-reset').onclick=()=>{simulation.reset();simulationNotice='Mazo barajado y mano vacía';renderSimulation();};
  const simOpen=localStorage.getItem('marvel.ui.simulator');if(simOpen!==null)$('draw-simulator').open=simOpen==='true';$('draw-simulator').ontoggle=()=>{try{localStorage.setItem('marvel.ui.simulator',String($('draw-simulator').open));}catch{}};
  $('trait-filter').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addTrait();}};
  $('add-trait').onclick=()=>addTrait();
  $('deck-traits-button').onclick=()=>toggleTraitList();
  document.addEventListener('click',e=>{if(!$('trait-search-options').contains(e.target)&&e.target!==$('trait-filter'))toggleTraitSuggestions(false);});
  for(const [id,view]of [['trait-list-deck','deck'],['trait-list-available','available']])$(id).onclick=()=>{traitListView=view;renderTraits();toggleTraitList(true);};
  document.addEventListener('click',e=>{if(!$('deck-traits-options').contains(e.target)&&!$('deck-traits-button').contains(e.target))toggleTraitList(false);});
  addEventListener('resize',()=>{toggleTraitSuggestions(false);toggleTraitList(false);toggleSearchOptions(false);closePinPopover();});
  $('trait-sort').onclick=()=>{traitSort=traitSort==='name'?'count':'name';renderTraits();};
  $('deck-traits-sort').onclick=e=>{e.preventDefault();e.stopPropagation();deckTraitSort=deckTraitSort==='name'?'count':'name';renderTraits();};
  const storedRows=localStorage.getItem('marvel.gallery-rows');if(storedRows!==null&&Number.isSafeInteger(Number(storedRows))&&Number(storedRows)>=0)rowLimit=Number(storedRows);
  selectedFirst=localStorage.getItem('marvel.group-selection')==='true';
  function showRows(){const input=$('row-limit');input.value=rowLimit===0?'Sin límite':String(rowLimit);input.setAttribute('aria-valuenow',String(rowLimit));input.setAttribute('aria-valuetext',input.value);}
  function setRows(value){if(Number.isSafeInteger(value)){rowLimit=Math.max(0,value);page=1;try{localStorage.setItem('marvel.gallery-rows',String(rowLimit));}catch{}renderGallery();}showRows();}
  showRows();
  const commitRows=()=>{const text=$('row-limit').value.trim();setRows(text===''||normalize(text)==='sin limite'?0:Number(text));};
  $('row-limit').onchange=commitRows;$('row-limit').onblur=commitRows;
  $('row-limit').onkeydown=e=>{if(e.key==='Enter'){$('row-limit').blur();}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setRows(rowLimit+(e.key==='ArrowUp'?1:-1));}};
  $('row-less').onclick=()=>setRows(rowLimit-1);$('row-more').onclick=()=>setRows(rowLimit+1);
  $('page-prev').onclick=()=>{page--;renderGallery();};$('page-next').onclick=()=>{page++;renderGallery();};
  $('group-selection').onclick=()=>{selectedFirst=!selectedFirst;page=1;try{localStorage.setItem('marvel.group-selection',String(selectedFirst));}catch{}renderGallery();};
  $('reset-filters').replaceChildren(iconSvg('reset'));
  $('reset-filters').onclick=()=>{for(const id of ['search','trait-filter'])$(id).value='';setOtherPressed('hide-hero',false);setOtherPressed('same-aspect',true);setOtherPressed('advanced-traits',false);setOtherPressed('hero-trait-interaction',false);updateTraitMode();allyFilter.enabled=false;
    $('search-language').value='es';
    $('search-name').checked=true;$('search-text').checked=true;refreshSearchFields();
    $('trait-in-attribute').checked=true;$('trait-in-text').checked=true;refreshTraitSources();
    allyFilter.values={};
    selection.faction=new Set([...Object.keys(factions),...(specialRuleFor(cards[deck.hero])?['special']:[])]);selection.type=new Set(Object.keys(types));selection.cost=new Set(costOptions.map(([code])=>code));selection.resource=new Set(Object.keys(resources));selectedTraits=[];
    for(const key of Object.keys(single))single[key]=false;
    if(presetsReady&&currentPreset()){savePresetPatch(activePresetId,p=>{p.onlyPinned=false;p.enabled=true;});renderFilterTabs();}
    checklist('type',Object.entries(types));checklist('cost',costOptions);checklist('resource',Object.entries(resources));renderFactionFilter();page=1;renderGallery();};
  $('quick-reset-filters').onclick=()=>{selectedFirst=false;try{localStorage.setItem('marvel.group-selection','false');}catch{}for(const [index,id]of sortControls.entries())$(id).value=CARD_SORT_DEFAULTS[index];$('reset-filters').click();};
  $('clean-deck').onclick=cleanDeck;
  $('undo-clean-deck').onclick=()=>{if(cleanupUndo?.id===deck.id&&cleanupUndo.after===JSON.stringify(deck)){deck=clone(cleanupUndo.before);cleanupUndo=null;changed();}};
  $('deck-statistics').open=localStorage.getItem('marvel.ui.statistics')==='true';$('deck-statistics').ontoggle=()=>{try{localStorage.setItem('marvel.ui.statistics',String($('deck-statistics').open));}catch{}};
  $('gallery-options-toggle').onclick=()=>{const control=$('gallery-options-toggle');$('gallery-options').hidden=!$('gallery-options').hidden;control.setAttribute('aria-expanded',String(!$('gallery-options').hidden));};
  $('deck-hide-hero').checked=localStorage.getItem('marvel.ui.deck-hide-hero')==='true';
  $('deck-hide-hero').onchange=()=>{try{localStorage.setItem('marvel.ui.deck-hide-hero',String($('deck-hide-hero').checked));}catch{}renderDeck();};
  $('deck-name').oninput=()=>{deck.name=$('deck-name').value;deck.autoName=false;$('deck-view-name').textContent=deck.name;changed(false);};$('notes').oninput=()=>{deck.notes=$('notes').value;changed(false);};
  $('hero-select').onchange=()=>{centeredHeroForm=null;updateNewDeckControls();};
  $('new-deck-aspects').onchange=updateNewDeckControls;
  $('hero-view-toggle').onclick=()=>{
    setHeroView(!showHeroDisplay);
    if(showHeroDisplay&&!$('hero-select').value)stepHero(1);
    else updateNewDeckControls();
  };
  $('hero-prev').onclick=()=>stepHero(-1);$('hero-next').onclick=()=>stepHero(1);
  $('hero-face-toggle').onclick=()=>{showAlterEgo=!showAlterEgo;renderHeroDisplay();};
  $('hero-display').onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();stepHero(event.key==='ArrowLeft'?-1:1);
  };
  enableHeroSwipe();
  $('hero-faces').addEventListener('wheel',event=>{
    const delta=event.deltaX||(event.shiftKey?event.deltaY:0);
    if(!delta||event.ctrlKey||Math.abs(delta)<Math.abs(event.deltaY)&&!event.shiftKey)return;
    event.preventDefault();
    const now=performance.now(), direction=Math.sign(delta), elapsed=now-lastWheelTime;
    lastWheelTime=now;
    if(heroWheelPaused&&elapsed<180)return;
    heroWheelPaused=false;
    if(elapsed>180||direction!==wheelDirection)wheelDistance=0;
    const pixels=event.deltaMode===1?delta*18:event.deltaMode===2?delta*120:delta;
    const level=Number($('hero-acceleration').value);
    wheelDistance+=pixels*[0.7,0.9,1][level]*(elapsed<45&&direction===wheelDirection?[1,1.2,1.45][level]:1);
    wheelDirection=direction;
    const steps=Math.max(-3,Math.min(3,Math.trunc(wheelDistance/60)));
    if(steps){wheelDistance%=60;stepHero(steps);}
  },{passive:false});
  for(const id of ['advanced-traits','hero-trait-interaction'])$(id).onclick=()=>{
    setOtherPressed(id,!otherPressed(id));updateTraitMode();
    toggleTraitSuggestions(false);toggleTraitList(false);page=1;renderEditedFilter();
  };
  $('hero-detail').onclick=()=>{
    stopHeroWheel();
    const band=showHeroDisplay?heroBand():[];
    cardDetail(band[heroBandIndex(band)]?.card.code||$('hero-select').value);
  };
  $('hero-language').onclick=()=>{
    heroLanguage=heroLanguage==='es'?'en':'es';
    try{localStorage.setItem('marvel.ux.hero-language',heroLanguage);}catch{}
    renderHeroOptions();
  };
  $('aspect-select').onchange=()=>{
    const next=[...$('aspect-select').selectedOptions].map(o=>o.value);
    pendingAspects=next.length===deck.aspects.length&&next.every(value=>deck.aspects.includes(value))?null:next;
    $('confirm-aspects').hidden=pendingAspects===null;
  };
  $('confirm-aspects').onclick=()=>{if(readOnly||!pendingAspects)return;deck.aspects=pendingAspects;pendingAspects=null;updateAutoName();page=1;changed();};
  $('save-changes').onclick=()=>commit();$('export-text').onclick=exportText;
  $('library-import-file').onchange=e=>{importFile(e.target.files[0],true);e.target.value='';};
  $('add-group').onclick=()=>{if(readOnly)return;try{addCustomGroup(deck,$('group-name').value);$('group-name').value='';changed();}catch(e){report(e);}};
  $('group-name').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('add-group').click();}};
  for(const id of ['grouping-mode','detail-grouping-mode']){
    $(id).onchange=()=>{deck.grouping.mode=$(id).value;pendingGroupDelete=null;if(readOnly)renderDeck();else changed();};
  }
  const groupRows=$('detail-group-rows');
  groupRows.setAttribute('aria-pressed',String(localStorage.getItem('marvel.ui.detail-group-rows')==='true'));
  groupRows.onclick=()=>{
    const pressed=String(groupRows.getAttribute('aria-pressed')!=='true');
    groupRows.setAttribute('aria-pressed',pressed);
    try{localStorage.setItem('marvel.ui.detail-group-rows',pressed);}catch{}
    renderDeckDetail();
  };
  $('versions-button').onclick=versions;$('library-button').onclick=library;
  $('theme-picker').prepend(iconSvg('theme'));
  $('settings-button').append(iconSvg('settings'));
  $('settings-button').onclick=openSettings;
  $('constructor-button').onclick=editCurrent;$('edit-current').onclick=()=>openSaved(store.load(deck.id)||{deck,revision});
  $('library-new').onclick=()=>openNewDeck();
  $('library-aspect').append(option('','Todos los aspectos'));for(const code of ['aggression','justice','leadership','protection','pool'])$('library-aspect').append(option(code,factions[code]));
  $('library-hero').onchange=renderLibrary;$('library-aspect').onchange=renderLibrary;
  $('library-armed').onclick=()=>{armedOnly=!armedOnly;retainedArmed=armedOnly?new Set(store.list().filter(r=>r.deck.armed).map(r=>r.deck.id)):new Set();renderLibrary();};
  for(const control of document.querySelectorAll('[data-sort]'))control.onclick=()=>{const key=control.dataset.sort;librarySort={sortKey:key,direction:librarySort.sortKey!==key?1:librarySort.direction===1?-1:librarySort.direction===-1?0:1};renderLibrary();};
  $('library-mobile-sort').onchange=event=>{
    const [sortKey,direction]=event.target.value.split(':');
    librarySort={sortKey,direction:Number(direction)||0};renderLibrary();
  };
  $('export-library').onclick=()=>download('biblioteca-mazos.json',JSON.stringify({format:'marvel-decks-v1',decks:store.list().map(r=>r.deck)},null,2));
  const mobile=matchMedia('(max-width: 850px)');
  const phoneLandscape=matchMedia('(max-width: 1100px) and (max-height: 500px) and (orientation: landscape)');
  const savedMobileColumns=Number(localStorage.getItem('marvel.mobile-gallery-columns'));
  let mobileColumns=Number.isInteger(savedMobileColumns)&&savedMobileColumns>=1&&savedMobileColumns<=6?savedMobileColumns:2;
  const maxMobileColumns=()=>phoneLandscape.matches?6:4;
  function applyVisualSettings(){
    document.documentElement.style.setProperty('--card-width',galleryWidth+'px');
    document.documentElement.style.setProperty('--deck-columns',String(deckColumns));
    document.documentElement.style.setProperty('--deck-width',deckColumns===2?'560px':'320px');
    $('deck-columns').textContent=deckColumns===1?'1 columna':'2 columnas';
    $('deck-columns').setAttribute('aria-label',deckColumns===2?'Mostrar una columna de cartas del mazo':'Mostrar dos columnas de cartas del mazo');
    const compactViewport=mobile.matches||phoneLandscape.matches;
    const columns=Math.min(mobileColumns,maxMobileColumns());
    const gallery=$('gallery');
    gallery.classList.toggle('mobile-density',compactViewport);
    gallery.classList.toggle('compact-cards',compactViewport&&columns>=3);
    gallery.style.setProperty('--mobile-gallery-columns',String(columns));
    $('mobile-gallery-density').hidden=!compactViewport;
    $('mobile-gallery-density').textContent=`${columns} por fila`;
    $('zoom-out').disabled=compactViewport?columns===maxMobileColumns():galleryWidth<=140;
    $('zoom-in').disabled=compactViewport?columns===1:galleryWidth>=320;
    if(deck)renderGallery();
  }
  const width=Number(localStorage.getItem('marvel.gallery-width'));if(width>=140&&width<=320)galleryWidth=width;
  deckColumns=localStorage.getItem('marvel.deck-columns')==='1'?1:2;applyVisualSettings();
  for(const [id,step]of [['zoom-out',-1],['zoom-in',1]])$(id).onclick=()=>{
    if(mobile.matches||phoneLandscape.matches){
      const max=maxMobileColumns();
      mobileColumns=Math.max(1,Math.min(max,Math.min(mobileColumns,max)-step));
      try{localStorage.setItem('marvel.mobile-gallery-columns',String(mobileColumns));}catch{}
    }else{
      galleryWidth=Math.max(140,Math.min(320,galleryWidth+20*step));
      try{localStorage.setItem('marvel.gallery-width',String(galleryWidth));}catch{}
    }
    applyVisualSettings();
  };
  $('deck-columns').onclick=()=>{deckColumns=deckColumns===2?1:2;applyVisualSettings();try{localStorage.setItem('marvel.deck-columns',String(deckColumns));}catch{}};
  $('close-modal').onclick=()=>$('modal').close();
  $('detail-prev').onclick=()=>navigateDetail(-1);$('detail-next').onclick=()=>navigateDetail(1);
  $('modal').addEventListener('close',()=>{if($('modal').open)return;finishDrag();closePinPopover();document.body.append($('pin-popover'));detailNavigation=null;detailCode='';$('detail-tools').hidden=true;});
  addEventListener('keydown',detailShortcut);
  addEventListener('scroll',e=>{
    hideHover();
    if(traitSuggestionsOpen&&!$('trait-search-options').contains(e.target)){
      const anchor=$('trait-filter').getBoundingClientRect();
      toggleTraitSuggestions(anchor.bottom>0&&anchor.top<innerHeight);
    }
    if(!$('deck-traits-options').contains(e.target))toggleTraitList(false);
    if(!$('pin-popover').contains(e.target))closePinPopover();
    if(!$('search-options').contains(e.target))toggleSearchOptions(false);
  },true);
  addEventListener('keydown',e=>{if(e.key==='Escape'){hideHover();toggleTraitSuggestions(false);closePinPopover();if(!$('search-options').hidden){toggleSearchOptions(false);$('search-options-toggle').focus();}if(!$('deck-traits-options').hidden){toggleTraitList(false);$('deck-traits-button').focus();}}});
  const activePanel=localStorage.getItem('marvel.active-panel')||'none';
  const catalogTools=$('mobile-catalog-tools');
  const mobileFilters=$('mobile-filter-area');
  const filterResults=$('mobile-filter-results');
  filterResults.onclick=()=>{
    setActivePanel('none',false);
    $('gallery-title').focus();
  };
  const searchRow=$('search').closest('.catalog-search');
  const galleryControls=$('gallery-options-toggle').parentElement;
  const mobilePlacements=[
    [searchRow,catalogTools],
    [$('filter-presets'),mobileFilters],
    [$('filter-panel'),mobileFilters],
    [$('other-tab'),mobileFilters],
    [$('ally-options'),mobileFilters],
    [$('other-options'),mobileFilters],
    [filterResults,mobileFilters],
    [mobileFilters,catalogTools],
    [$('active-filter-summary'),catalogTools],
    [$('gallery-options-toggle'),$('mobile-gallery-options')],
    [galleryControls,$('gallery-options')],
  ].map(([node,destination])=>{
    const anchor=document.createComment('');
    node.before(anchor);
    return {node,destination,anchor};
  });
  const generalAnchor=document.createComment('');
  $('deck-panel').before(generalAnchor);
  function arrangeConstructor(){
    if(mobile.matches)generalAnchor.after($('deck-panel'));
    else $('deck-column').prepend($('deck-panel'));
    for(const {node,destination,anchor} of mobilePlacements){
      if(mobile.matches)destination.append(node);
      else anchor.after(node);
    }
  }
  arrangeConstructor();
  mobile.addEventListener('change',()=>{
    arrangeConstructor();
    applyVisualSettings();
  });
  phoneLandscape.addEventListener('change',applyVisualSettings);
  function setActivePanel(id,persist=true){
    const state=id==='deck-panel'?'deck':id==='filter-panel'?'filter':'none';$('config-bar').dataset.active=state;
    $('other-tab').hidden=state!=='filter';$('other-options').hidden=true;$('other-tab').setAttribute('aria-expanded','false');
    for(const [panel,tab]of [['deck-panel','deck-tab'],['filter-panel','filter-tab']]){
      $(panel).hidden=panel!==id;$(tab).setAttribute('aria-expanded',String(panel===id));
    }
    $('catalog-filters').setAttribute('aria-expanded',String(state==='filter'));
    mobileFilters.hidden=state!=='filter';
    if(persist)try{localStorage.setItem('marvel.active-panel',id);}catch{}
    renderFilterTabs();renderAllyFilters();closePinPopover();toggleSearchOptions(false);toggleTraitList(false);toggleTraitSuggestions(false);
  }
  setActivePanel(localStorage.getItem('marvel.active-panel')==='none'?'none':activePanel);
  $('deck-column-toggle').onclick=()=>{
    const control=$('deck-column-toggle');
    control.setAttribute('aria-expanded',String(control.getAttribute('aria-expanded')==='false'));
    hideHover();
  };
  function setAvailableCards(open){
    $('available-cards').hidden=!open;
    $('available-tab').setAttribute('aria-expanded',String(open));
  }
  let restoreFilters=false,restoreOther=false;
  function setDeckDetail(open){
    if(open){
      restoreFilters=!$('filter-panel').hidden;restoreOther=!$('other-options').hidden;
      if(restoreFilters)setActivePanel('none',false);
    }else if(restoreFilters){
      setActivePanel('filter-panel',false);
      if(restoreOther)$('other-tab').click();
    }
    $('deck-detail').hidden=!open;setAvailableCards(!open);
    $('deck-detail-toggle').setAttribute('aria-expanded',String(open));
    hideHover();renderDeckDetail();
  }
  $('deck-detail-toggle').onclick=()=>{
    const open=$('deck-detail').hidden;
    setDeckDetail(open);
    if(open&&!mobile.matches){
      $('mobile-cards').setAttribute('aria-pressed','false');
      $('mobile-deck').setAttribute('aria-pressed','false');
    }else setMobilePane($('constructor-view').dataset.mobilePane);
  };
  $('available-tab').onclick=()=>{
    if(!$('deck-detail').hidden)setDeckDetail(false);
    else setAvailableCards($('available-cards').hidden);
    hideHover();
  };
  $('deck-tab').onclick=()=>{
    restoreFilters=false;
    const open=$('deck-panel').hidden;
    if(open&&!mobile.matches)$('deck-column-toggle').setAttribute('aria-expanded','true');
    setActivePanel(open?'deck-panel':'none');
  };
  $('filter-tab').onclick=()=>{
    if(!$('deck-detail').hidden){restoreFilters=false;setDeckDetail(false);setActivePanel('filter-panel');}
    else setActivePanel($('filter-panel').hidden?'filter-panel':'none');
  };
  $('other-tab').onclick=()=>{$('other-options').hidden=!$('other-options').hidden;$('other-tab').setAttribute('aria-expanded',String(!$('other-options').hidden));};
  function setMobilePane(pane){
    $('constructor-view').dataset.mobilePane=pane;
    $('mobile-cards').setAttribute('aria-pressed',String(pane==='cards'));
    $('mobile-deck').setAttribute('aria-pressed',String(pane==='deck'));
  }
  $('mobile-cards').onclick=()=>{
    if(!$('deck-detail').hidden)setDeckDetail(false);
    setAvailableCards(true);setMobilePane('cards');
    if(!$('deck-panel').hidden)setActivePanel('none');
  };
  $('mobile-deck').onclick=()=>{
    if(!$('deck-detail').hidden)setDeckDetail(false);
    if(!$('filter-panel').hidden)setActivePanel('none');
    $('deck-column-toggle').setAttribute('aria-expanded','true');
    setMobilePane('deck');
  };
  $('explore-cards-ux').onclick=()=>{
    $('mobile-cards').click();$('search').focus();
  };
  $('catalog-filters').onclick=()=>{
    if(mobile.matches)setActivePanel($('filter-panel').hidden?'filter-panel':'none',false);
    else $('filter-tab').click();
  };
  $('back-to-library').onclick=()=>{library();window.scrollTo(0,0);};
  const wanted=new URLSearchParams(location.search).get('deck')||sessionStorage.getItem('marvel.last');
  let existing=wanted?store.load(wanted):null;
  if(!existing&&wanted){try {const draft=JSON.parse(sessionStorage.getItem('marvel.draft.'+wanted));if(draft)existing={deck:draft.deck,revision:draft.revision};}catch{}}
  if(existing)openSaved(existing);
  else deck=createDeck();
  if(!deck.hero)showView('library');
  setupPresets();
  let observedWidth=0;
  new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width>0&&Math.abs(width-observedWidth)>.5){observedWidth=width;renderGallery();}}).observe($('gallery'));
  addEventListener('storage',event=>{
    if(isPresetStorageKey(event.key)){reloadPresets();}
    if(event.key==='marvel.filters.enabled'){advancedFilters=event.newValue==='true';setOtherPressed('advanced-filters',advancedFilters);renderFilterTabs();renderGallery();}
    if(event.key==='marvel.filters.owned'||event.key==='marvel.show-variants'){
      setOtherPressed(event.key==='marvel.filters.owned'?'owned-only':'show-variants',event.newValue==='true');page=1;renderGallery();
    }
    if(deck&&event.key==='marvel.deck.'+deck.id)status(dirty?'Este mazo cambió en otra pestaña. Tu borrador se conserva y al guardar se comprobará la revisión.':'Este mazo cambió en otra pestaña. Recarga para abrir la última revisión guardada.');
    if(event.key?.startsWith('marvel.product.')){const key=event.key.slice('marvel.product.'.length);collection[key]=event.newValue===null?1:Number(event.newValue)>0?1:0;renderGallery();}
    if(!$('library-view').hidden)renderLibrary();
  });
}
init().catch(e=>{report(e);$('gallery').append(el('p','No se pudo iniciar el gestor. Usa el servidor local indicado en README.','empty'));});
if(location.protocol==='https:'&&'serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.mjs',{type:'module'}).catch(error=>console.warn('No se pudo activar el modo sin conexión.',error));
  });
}
