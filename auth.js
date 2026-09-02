const { createClient } = window.supabase;
const sb = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
window.sb = sb;

const authState = { session: null, profile: null, tripId: null, trip: null, member: null };
const savedJoinToken = () => localStorage.getItem('trip_join_token');
function rememberJoinToken(){ const t=new URLSearchParams(location.search).get('join'); if(t) localStorage.setItem('trip_join_token',t); }
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

rememberJoinToken();
async function bootAuth(){
  if(window.SUPABASE_CONFIG.url.includes('YOUR_PROJECT')) return false;
  const {data:{session}} = await sb.auth.getSession();
  authState.session=session;
  sb.auth.onAuthStateChange((_e,s)=>{authState.session=s; if(window.refreshAppAuth) window.refreshAppAuth();});
  if(session) await loadIdentity();
  return true;
}
async function loadIdentity(){
  const u=authState.session?.user; if(!u) return;
  let {data:p}=await sb.from('profiles').select('*').eq('user_id',u.id).maybeSingle();
  if(!p){
    const {data:np}=await sb.from('profiles').insert({user_id:u.id,display_name:u.user_metadata?.full_name||u.email?.split('@')[0]||'کاربر',phone:u.user_metadata?.phone||null}).select().single(); p=np;
  }
  authState.profile=p;
  const inviteToken=savedJoinToken();
  if(inviteToken) await showJoinFlow(inviteToken);
  const {data:ms}=await sb.from('trip_members').select('*, trips(*)').eq('user_id',u.id).order('created_at',{ascending:false}).limit(1);
  if(ms?.[0]){authState.member=ms[0];authState.tripId=ms[0].trip_id;authState.trip=ms[0].trips;}
}

window.showAuth=()=>{
 const m=document.querySelector('#modal');
 m.innerHTML=`<div class="sheet auth-sheet"><button class="close" onclick="closeModal()">×</button><div class="auth-brand">🌲</div><h2>ورود به سفر</h2><p class="muted">برای استفاده از برنامه وارد حساب خود شوید.</p><div class="form"><label>ایمیل<input id="authEmail" type="email" autocomplete="email"></label><label>رمز عبور<input id="authPassword" type="password" autocomplete="current-password"></label><button class="btn" onclick="loginUser()">ورود</button><button class="btn secondary" onclick="showSignup()">ایجاد حساب جدید</button></div><div id="authMsg" class="muted"></div></div>`;m.classList.remove('hidden');
};
window.showSignup=()=>{
 const m=document.querySelector('#modal');m.innerHTML=`<div class="sheet auth-sheet"><button class="close" onclick="closeModal()">×</button><h2>ایجاد حساب</h2><div class="form"><label>نام و نام خانوادگی<input id="suName" autocomplete="name"></label><label>موبایل<input id="suPhone" autocomplete="tel"></label><label>ایمیل<input id="suEmail" type="email" autocomplete="email"></label><label>رمز عبور<input id="suPass" type="password" minlength="6"></label><button class="btn" onclick="signupUser()">ثبت‌نام</button><button class="btn secondary" onclick="showAuth()">بازگشت به ورود</button></div><div id="authMsg" class="muted"></div></div>`;m.classList.remove('hidden');
};
window.loginUser=async()=>{const msg=document.querySelector('#authMsg');msg.textContent='در حال ورود...';const {error}=await sb.auth.signInWithPassword({email:document.querySelector('#authEmail').value,password:document.querySelector('#authPassword').value});msg.textContent=error?.message||'ورود موفق بود.';if(!error){await loadIdentity();closeModal();window.refreshAppAuth?.();}};
window.signupUser=async()=>{const name=document.querySelector('#suName').value.trim(),phone=document.querySelector('#suPhone').value.trim(),email=document.querySelector('#suEmail').value.trim(),password=document.querySelector('#suPass').value;const msg=document.querySelector('#authMsg');msg.textContent='در حال ثبت‌نام...';const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:name,phone}}});if(error){msg.textContent=error.message;return;}if(data.user && data.session){await sb.from('profiles').upsert({user_id:data.user.id,display_name:name,phone}).select(); await loadIdentity(); if(savedJoinToken()) await showJoinFlow(savedJoinToken());}msg.textContent='ثبت‌نام انجام شد. اگر تأیید ایمیل فعال باشد، ایمیل خود را تأیید کنید.';};
window.logoutUser=async()=>{await sb.auth.signOut();location.reload();};

async function showJoinFlow(token){
  const {data:rows,error}=await sb.rpc('lookup_active_invite',{p_token:token});
  const inv=rows?.[0];
  if(error||!inv){alert('لینک دعوت نامعتبر یا منقضی شده است.');return;}
  const m=document.querySelector('#modal');m.innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>👋 عضویت در ${esc(inv.trip_title||'سفر')}</h2><p>اطلاعات شما برای ادمین ارسال می‌شود و پس از تأیید، ضریب مشارکت و سهم صندوق تعیین خواهد شد.</p><div class="form"><label>نام و نام خانوادگی<input id="jrName" value="${esc(authState.profile?.display_name||'')}"></label><label>شماره موبایل<input id="jrPhone" value="${esc(authState.profile?.phone||'')}"></label><label>توضیح برای ادمین<textarea id="jrNote"></textarea></label><button class="btn" onclick="submitJoin(${inv.invite_id},'${inv.trip_id}')">ارسال درخواست عضویت</button></div></div>`;m.classList.remove('hidden');
}
window.submitJoin=async(inviteId,tripId)=>{const {error}=await sb.from('membership_requests').insert({trip_id:tripId,invite_id:inviteId,user_id:authState.session.user.id,full_name:document.querySelector('#jrName').value.trim(),phone:document.querySelector('#jrPhone').value.trim(),note:document.querySelector('#jrNote').value.trim()});if(error){alert(error.message);return;}alert('درخواست عضویت برای ادمین ارسال شد. پس از تأیید، حساب شما فعال می‌شود.'); localStorage.removeItem('trip_join_token'); closeModal();};
window.authState=authState; window.bootAuth=bootAuth;
