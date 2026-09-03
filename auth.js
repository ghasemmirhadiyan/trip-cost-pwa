const { createClient } = window.supabase;
const sb = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
window.sb = sb;

const authState = { session: null, profile: null, tripId: null, trip: null, member: null };
const SINGLE_TRIP_MODE = true;
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
  const {data:ms,error:me}=await sb.from('trip_members').select('*, trips(*)').eq('user_id',u.id).eq('active',true).order('created_at',{ascending:false}).limit(1);
  if(me) console.error('load single trip',me);
  const chosen=ms?.[0];
  if(chosen?.trips){
    authState.member=chosen;
    authState.tripId=chosen.trips.id;
    authState.trip=chosen.trips;
  } else {
    authState.member=null;authState.tripId=null;authState.trip=null;
  }
}

window.showAuth=(forced=false)=>{
 const m=document.querySelector('#modal');
 m.innerHTML=`<div class="sheet auth-sheet">${forced?'':'<button class="close" onclick="closeModal()">×</button>'}<div class="auth-brand">🌲</div><h2>ورود به سفر</h2><p class="muted">برای استفاده از برنامه وارد حساب خود شوید.</p><div class="form"><label>نام کاربری یا ایمیل<input id="authEmail" autocomplete="username"></label><label>رمز عبور<input id="authPassword" type="password" autocomplete="current-password"></label><button class="btn" onclick="loginUser()">ورود</button><button class="btn secondary" onclick="showSignup()">➕ ایجاد حساب جدید</button><button type="button" class="btn secondary test-connection-btn" onclick="testSupabaseConnection(true)">Test Connection</button></div><div id="authMsg" class="muted"></div></div>`;m.classList.remove('hidden');
};
window.showSignup=()=>{
 const m=document.querySelector('#modal');m.innerHTML=`<div class="sheet auth-sheet"><button class="close" onclick="closeModal()">×</button><h2>ایجاد حساب</h2><p class="muted">اگر با لینک دعوت وارد شده‌اید، بعد از ساخت حساب درخواست عضویت شما برای مدیر سفر ارسال می‌شود. ضریب پیش‌فرض عضویت <b>۱</b> است و مدیر می‌تواند آن را تغییر دهد.</p><div class="form"><label>نام و نام خانوادگی<input id="suName" autocomplete="name"></label><label>موبایل<input id="suPhone" autocomplete="tel"></label><label>ایمیل<input id="suEmail" type="email" autocomplete="email"></label><label>رمز عبور<input id="suPass" type="password" minlength="6"></label><button class="btn" onclick="signupUser()">ثبت‌نام</button><button type="button" class="btn secondary test-connection-btn" onclick="testSupabaseConnection(true)">Test Connection</button><button class="btn secondary" onclick="showAuth()">بازگشت به ورود</button></div><div id="authMsg" class="muted"></div></div>`;m.classList.remove('hidden');
};
function authErrorText(error, action='درخواست'){
  if(!error) return '';
  const code=error.code||error.name||'بدون کد';
  const status=error.status||error.statusCode||'';
  const msg=error.message||String(error);
  const hint=error.hint||error.details||'';
  let help='';
  if(msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')){
    help='اتصال مرورگر به Supabase برقرار نشد. اینترنت، آدرس پروژه، کلید Publishable و تنظیمات دامنه را بررسی کنید.';
  } else if(code==='user_already_exists' || msg.toLowerCase().includes('already registered')){
    help='این ایمیل قبلاً ثبت شده است. از گزینه ورود استفاده کنید.';
  } else if(code==='weak_password' || msg.toLowerCase().includes('password')){
    help='رمز عبور را مطابق حداقل الزامات Supabase وارد کنید.';
  } else if(code==='email_address_invalid'){
    help='فرمت ایمیل صحیح نیست.';
  }
  console.error('[Supabase]', {action, code, status, message:msg, hint, error});
  return `خطا در ${action}:\n${msg}${code?`\nکد: ${code}`:''}${status?`\nHTTP: ${status}`:''}${hint?`\nجزئیات: ${hint}`:''}${help?`\n\nراهنما: ${help}`:''}`;
}

window.testSupabaseConnection=async(show=true)=>{
  const url=window.SUPABASE_CONFIG?.url||'';
  const key=window.SUPABASE_CONFIG?.anonKey||'';
  const result={ok:false,url,keyPresent:!!key,status:null,message:''};
  const render=(text,ok)=>{ const msg=document.querySelector('#authMsg'); if(msg){msg.textContent=text;msg.className=ok?'connection-result success':'connection-result error';} };
  try{
    if(!url || !/^https:\/\/[^/]+\.supabase\.co$/.test(url)) throw new Error('آدرس Supabase نامعتبر است.');
    if(!key) throw new Error('کلید اتصال وجود ندارد.');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    let r;
    try{ r=await fetch(url+'/auth/v1/settings',{method:'GET',headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal:controller.signal}); }
    finally{ clearTimeout(timer); }
    result.status=r.status;
    if(!r.ok) throw new Error('HTTP '+r.status);
    result.ok=true; result.message='موفق';
  }catch(e){
    result.message=e?.name==='AbortError'?'اتصال زمان‌بر شد':(e?.message||'ناموفق');
    console.error('[Supabase connection test]',e);
  }
  if(show) render(result.ok?'موفق ✓':'ناموفق ✕',result.ok);
  return result;
};
window.loginUser=async()=>{
 const msg=document.querySelector('#authMsg');msg.classList.remove('error');msg.textContent='در حال بررسی اتصال و ورود...';
 try{
  const test=await window.testSupabaseConnection(false);
  if(!test.ok){msg.textContent=`❌ اتصال به سرور برقرار نشد.\n${test.message}\n\nاگر خطا «Failed to fetch» است، دکمه «تست اتصال» را بزنید و نتیجه را ببینید.`;msg.classList.add('error');return;}
  const email=document.querySelector('#authEmail').value.trim(),password=document.querySelector('#authPassword').value;
  if(!email||!password){msg.textContent='نام کاربری و رمز عبور را وارد کنید.';return;}
  let loginEmail=email;
  if(!email.includes('@')){ const {data:resolved,error:re}=await sb.rpc('resolve_username',{p_username:email}); if(re){msg.textContent=authErrorText(re,'پیدا کردن نام کاربری');msg.classList.add('error');return;} loginEmail=resolved; }
  if(!loginEmail){msg.textContent='نام کاربری پیدا نشد.';msg.classList.add('error');return;}
  const {error}=await sb.auth.signInWithPassword({email:loginEmail,password});
  if(error){msg.textContent=authErrorText(error,'ورود');msg.classList.add('error');return;}
  msg.textContent='ورود موفق بود.'; await loadIdentity(); closeModal(); window.refreshAppAuth?.();
 }catch(e){msg.textContent=authErrorText(e,'ورود');msg.classList.add('error');}
};
window.signupUser=async()=>{
 const name=document.querySelector('#suName').value.trim(),phone=document.querySelector('#suPhone').value.trim(),email=document.querySelector('#suEmail').value.trim(),password=document.querySelector('#suPass').value;
 const msg=document.querySelector('#authMsg');msg.classList.remove('error');msg.textContent='در حال بررسی اتصال...';
 try{
  const test=await window.testSupabaseConnection(false);
  if(!test.ok){msg.textContent=`❌ اتصال به Supabase برقرار نشد.\n${test.message}\n\nاین پیام دقیقاً مشخص می‌کند مشکل از اتصال است یا ثبت‌نام.`;msg.classList.add('error');return;}
  if(!name||!email||!password){msg.textContent='نام، ایمیل و رمز عبور را کامل کنید.';return;}
  if(password.length<6){msg.textContent='رمز عبور باید حداقل ۶ کاراکتر باشد.';return;}
  msg.textContent='ارتباط برقرار است؛ در حال ثبت‌نام...';
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:name,phone}}});
  if(error){msg.textContent=authErrorText(error,'ثبت‌نام');msg.classList.add('error');return;}
  if(data.user && data.session){
    const {error:pe}=await sb.from('profiles').upsert({user_id:data.user.id,display_name:name,phone}).select();
    if(pe){console.warn('Profile upsert warning',pe);msg.textContent=authErrorText(pe,'ثبت پروفایل');msg.classList.add('error');return;}
    await loadIdentity(); if(savedJoinToken()) await showJoinFlow(savedJoinToken());
  }
  msg.textContent=data.session?'✅ ثبت‌نام با موفقیت انجام شد.':'✅ حساب ایجاد شد. ایمیل خود را برای فعال‌سازی تأیید کنید.';
 }catch(e){msg.textContent=authErrorText(e,'ثبت‌نام');msg.classList.add('error');}
};
window.logoutUser=async()=>{await sb.auth.signOut();location.reload();};

async function showJoinFlow(token){
  const {data:rows,error}=await sb.rpc('lookup_active_invite',{p_token:token});
  const inv=rows?.[0];
  if(error||!inv){alert('لینک دعوت نامعتبر یا منقضی شده است.');return;}
  const m=document.querySelector('#modal');m.innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>👋 عضویت در ${esc(inv.trip_title||'سفر')}</h2><p>اطلاعات شما برای ادمین ارسال می‌شود و پس از تأیید، ضریب مشارکت و سهم صندوق تعیین خواهد شد.</p><div class="form"><label>نام و نام خانوادگی<input id="jrName" value="${esc(authState.profile?.display_name||'')}"></label><label>شماره موبایل<input id="jrPhone" value="${esc(authState.profile?.phone||'')}"></label><label>توضیح برای ادمین<textarea id="jrNote"></textarea></label><button class="btn" onclick="submitJoin(${inv.invite_id},'${inv.trip_id}')">ارسال درخواست عضویت</button></div></div>`;m.classList.remove('hidden');
}
window.submitJoin=async(inviteId,tripId)=>{const {error}=await sb.from('membership_requests').insert({trip_id:tripId,invite_id:inviteId,user_id:authState.session.user.id,full_name:document.querySelector('#jrName').value.trim(),phone:document.querySelector('#jrPhone').value.trim(),note:document.querySelector('#jrNote').value.trim()});if(error){alert(error.message);return;}alert('درخواست عضویت برای ادمین ارسال شد. پس از تأیید، حساب شما فعال می‌شود.'); localStorage.removeItem('trip_join_token'); closeModal();};
window.authState=authState; window.bootAuth=bootAuth;
