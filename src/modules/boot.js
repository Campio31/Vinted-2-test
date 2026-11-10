import { app } from '../state.js';
import { initMonitoring, report } from '../monitoring.js';
import { $ } from './core.js';
import { idbOpen, setSync, tx } from './storage.js';
import { initAdd } from './add-view.js';
import { autoBackupCheck } from './backup.js';
import { cloud, countPending, showAuth, showReset, startSync, stopSync } from './sync.js';
import { checkWrappedBanner } from './wrapped-ready.js';
import { checkFiscAlert } from './fiscal.js';
import { isDep } from './publication.js';
import { checkNotifs } from './reminders.js';
import { checkNews } from './help-news.js';
import { checkSpace, startAutoCompress } from './performance.js';

initMonitoring();
initAdd();app.renderAll();
(async()=>{
 try{app.IDB=await idbOpen();app.P=await tx('pieces','readonly',s=>s.getAll())||[];app.DEP=app.P.filter(x=>isDep(x.id));app.P=app.P.filter(x=>!isDep(x.id));if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});await countPending()}
 catch(e){app.IDB=null;$('ro').hidden=false;report(e,{ou:'ouverture de la base'})}
 app.loaded=true;setSync('ok');app.renderAll();app.addForm.draw();if(!cloud)autoBackupCheck();checkWrappedBanner();checkFiscAlert();checkNews();checkSpace();startAutoCompress();checkNotifs();setInterval(checkNotifs,300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkNotifs()}});
 if(cloud){
  app.sb.auth.onAuthStateChange((ev,session)=>{setTimeout(()=>{if(ev==='PASSWORD_RECOVERY')showReset();if(session&&session.user)startSync(session.user);else if(ev==='SIGNED_OUT')stopSync()},0)});
  try{const r=await app.sb.auth.getSession();if(r.data&&r.data.session)startSync(r.data.session.user);else showAuth()}catch(e){showAuth()}
 }
 if('serviceWorker' in navigator&&location.protocol!=='file:')app.initUpdates();
})();
