const APP_VERSION = "12.6";
const state={role:'admin',user:'قاسم',trip:'سفر شمال ۱۴۰۵',pendingMembers:[],members:[],expenses:[],locations:[],shareAmount:12000000};
const $=s=>document.querySelector(s); let modal=()=>document.querySelector('#modal');
const money=n=>new Intl.NumberFormat('fa-IR').format(Number(n)||0)+' تومان';
const statusFa=s=>({pending:'در انتظار',approved:'تأیید شده',rejected:'رد شده'}[s]||s||'در انتظار');
async function loadTripSettings(){
 if(!window.authState?.tripId)return null;
 const {data,error}=await window.sb.from('trips').select('id,share_amount').eq('id',window.authState.tripId).maybeSingle();
 if(error) throw error;
 state.shareAmount=Number(data?.share_amount||12000000);
 return data;
}
async function loadTripMembers(){
 if(!window.authState?.tripId)return [];
 const {data,error}=await window.sb.from('trip_members').select('id,user_id,name,role,share_weight,contribution_target,active').eq('trip_id',window.authState.tripId).eq('active',true).order('created_at');
 if(error)throw error;
 state.members=data||[];
 const ids=state.members.map(m=>m.user_id).filter(Boolean);
 if(ids.length){ const {data:ps}=await window.sb.from('profiles').select('user_id,avatar_url').in('user_id',ids); const amap=Object.fromEntries((ps||[]).map(x=>[x.user_id,x.avatar_url])); state.members=state.members.map(m=>({...m,avatar_url:amap[m.user_id]||null})); }
 return state.members;
}
async function loadLocations(){
 if(!window.authState?.tripId)return [];
 const {data,error}=await window.sb.from('locations').select('id,name,description,category,latitude,longitude,map_url,suggested_duration_minutes,created_by,created_at,status,submitted_by,rejection_reason').eq('trip_id',window.authState.tripId).order('created_at',{ascending:false});
 if(error)throw error; state.locations=data||[]; return state.locations;
}
async function loadExpenses(){
 const grid=document.querySelector('#pendingPreview');
 if(!window.authState?.tripId){if(grid)grid.innerHTML='<div class="empty-state">برای مشاهده هزینه‌ها وارد حساب شوید و عضو سفر باشید.</div>';return [];}
 const {data,error}=await window.sb.from('expenses').select('id,trip_id,expense_date,title,category,amount,from_fund,payer_member_id,status,submitted_by,note,created_at').eq('trip_id',window.authState.tripId).order('created_at',{ascending:false});
 if(error){console.error(error);return [];}
 state.expenses=data||[]; renderPending(); return state.expenses;
}
window.loadFinancialSummary=async function loadFinancialSummary(){
 if(!window.authState?.tripId) return null;
 const [{data:trip,error:te},{data:members,error:me}]=await Promise.all([
  window.sb.from('trip_financial_summary').select('*').eq('trip_id',window.authState.tripId).maybeSingle(),
  window.sb.from('member_financial_summary').select('*').eq('trip_id',window.authState.tripId).order('name')
 ]);
 if(te) console.error('trip financial summary',te); if(me) console.error('member financial summary',me);
 return {trip:trip||null,members:members||[]};
}

function renderPending(){
 const el=document.querySelector('#pendingPreview');
 const pending=state.expenses.filter(x=>x.status==='pending');
 if(el)el.innerHTML=pending.slice(0,3).map(x=>`<article class="pending-card"><span>🟡</span><div class="grow"><b>${escapeHtml(x.title)}</b><small>${x.from_fund?'پرداخت از صندوق':'پرداخت شخصی'} • امروز</small></div><span class="amount">${money(x.amount)}</span></article>`).join('')||'<div class="empty-state">هزینه در انتظار تأیید وجود ندارد.</div>';
 const pc=document.querySelector('#pendingCount'); if(pc)pc.textContent=pending.length;
}
window.showPage=async function showPage(page){let title='',body='';
 if(page==='home'){ location.reload(); return; }
 if(page==='expenses'||page==='pending'||page==='approved'||page==='rejected'){title=page==='pending'?'🟡 هزینه‌های در انتظار تأیید':page==='approved'?'🟢 هزینه‌های تأیید شده':page==='rejected'?'🔴 هزینه‌های رد شده':'💰 هزینه‌ها'; const arr=page==='pending'?state.expenses.filter(e=>e.status==='pending'):page==='approved'?state.expenses.filter(e=>e.status==='approved'):page==='rejected'?state.expenses.filter(e=>e.status==='rejected'):state.expenses; body=`<div class="filter-row"><button class="chip ${page==='expenses'?'active':''}" onclick="showPage('expenses')">همه</button><button class="chip ${page==='pending'?'active':''}" onclick="showPage('pending')">🟡 در انتظار</button><button class="chip ${page==='approved'?'active':''}" onclick="showPage('approved')">🟢 تأیید شده</button><button class="chip ${page==='rejected'?'active':''}" onclick="showPage('rejected')">🔴 رد شده</button></div>${arr.map(e=>{const payer=state.members.find(m=>m.id===e.payer_member_id);return `<div class="list-item"><span class="badge ${e.status==='pending'?'pending':e.status==='approved'?'approved':'danger'}">${statusFa(e.status)}</span><b>${escapeHtml(e.title)}</b><p>${e.from_fund?'🏦 صندوق':escapeHtml(payer?.name||'پرداخت‌کننده')} • ${money(e.amount)}</p><small>تاریخ: ${e.expense_date||''}</small>${window.authState?.member?.role==='admin'&&e.status==='pending'?`<div class="actions"><button class="btn small" onclick="approveExpense('${e.id}')">✓ تأیید</button><button class="btn danger small" onclick="rejectExpense('${e.id}')">× رد</button></div>`:''}</div>`}).join('')||'<div class="empty-state">موردی برای نمایش وجود ندارد.</div>'}<button class="btn" onclick="newExpense()">➕ ثبت هزینه جدید</button>`; setTimeout(loadTripMembers,0); setTimeout(loadExpenses,0);
 } else if(page==='fund'){title='🏦 صندوق';body=`<div id="fundLive"><div class="stat primary"><span>موجودی فعلی صندوق</span><strong>در حال محاسبه...</strong><small>تومان</small></div><div class="stat" style="margin-top:10px"><span>📥 مطالبات صندوق</span><strong>در حال محاسبه...</strong><small>تومان</small></div></div><button class="btn" onclick="newContribution()">➕ ثبت واریزی به صندوق</button><div id="contributionList"><div class="list-item"><b>تراکنش‌های صندوق</b><p class="muted">در حال بارگذاری...</p></div></div>`;setTimeout(async()=>{const f=await loadFinancialSummary();const t=f?.trip||{};const memberRows=f?.members||[];const totalWeight=memberRows.reduce((sum,m)=>sum+Number(m.share_weight||0),0);const totalExpected=totalWeight*Number(t.share_amount||state.shareAmount||0);const totalPaid=memberRows.reduce((sum,m)=>sum+Number(m.approved_contributions||0),0);const totalClaim=Math.max(totalExpected-totalPaid,0);const totalOver=Math.max(totalPaid-totalExpected,0);const el=document.querySelector('#fundLive');if(el)el.innerHTML=`<div class="fund-overview"><div class="stat primary"><span>🎯 کل مبلغ مورد انتظار صندوق</span><strong>${money(totalExpected)}</strong><small>${Number(t.share_amount||state.shareAmount||0).toLocaleString('fa-IR')} تومان برای هر سهم × ${totalWeight.toLocaleString('fa-IR')} مجموع ضریب اعضا</small></div><div class="fund-grid"><div class="stat"><span>💵 پرداخت تأییدشده</span><strong>${money(totalPaid)}</strong></div><div class="stat"><span>📥 مانده قابل وصول</span><strong>${money(totalClaim)}</strong></div><div class="stat"><span>🏦 موجودی فعلی صندوق</span><strong>${money(t.current_fund_balance)}</strong></div><div class="stat"><span>💳 طلب مازاد</span><strong>${money(totalOver)}</strong></div></div><div class="formula-box"><b>فرمول محاسبه</b><p>مبلغ هر سهم × مجموع ضرایب اعضا = کل مبلغ مورد انتظار صندوق</p><p>${money(Number(t.share_amount||state.shareAmount||0))} × ${totalWeight.toLocaleString('fa-IR')} = <b>${money(totalExpected)}</b></p></div></div>`;const rows=await loadContributions();const lm=document.querySelector('#contributionList');if(lm)lm.innerHTML=`<div class="section-head"><h3>📋 وضعیت پرداخت اعضا</h3></div>${(f?.members||[]).map(m=>{const target=Number(m.contribution_target||0),paid=Number(m.approved_contributions||0),diff=paid-target;const label=diff<0?'بدهکار':diff>0?'طلبکار':'تسویه';return `<div class="list-item"><b>${escapeHtml(m.name)}</b><span class="badge ${diff<0?'pending':diff>0?'approved':'approved'}">${label}</span><p>تعهد: ${money(target)} • پرداخت تأییدشده: ${money(paid)}</p><small>${diff<0?`بدهی به صندوق: ${money(-diff)}`:diff>0?`طلب از صندوق: ${money(diff)}`:'حساب صندوق تسویه است'}</small></div>`}).join('')}<div class="section-head"><h3>📥 تراکنش‌های صندوق</h3></div>`+rows.map(c=>{const m=state.members.find(x=>Number(x.id)===Number(c.trip_member_id));const cls=c.status==='approved'?'approved':c.status==='rejected'?'danger':'pending';const label=statusFa(c.status);const actions=window.authState?.member?.role==='admin'&&c.status==='pending'?`<div class="actions"><button class="btn small" onclick="approveContribution('${c.id}')">✓ تأیید</button><button class="btn danger small" onclick="rejectContribution('${c.id}')">× رد</button></div>`:'';return `<div class="list-item"><span class="badge ${cls}">${label}</span><b>📥 ${escapeHtml(m?.name||'عضو')}</b><p>${money(c.amount)} تومان • ${c.method==='cash'?'نقدی':c.method==='card'?'کارت':c.method==='bank_transfer'?'انتقال بانکی':'سایر'}</p><small>تاریخ: ${c.contribution_date||''}</small>${c.note?`<p>${escapeHtml(c.note)}</p>`:''}${actions}</div>`}).join('')||'<div class="empty-state">هنوز واریزی ثبت نشده است.</div>';},0);
 } else if(page==='members'){await loadTripSettings();await loadTripMembers();title='👥 اعضای سفر';body=`<div class="stat primary"><span>💰 مبلغ هر سهم</span><strong>${money(state.shareAmount)}</strong><small>تعهد هر عضو به‌صورت خودکار محاسبه می‌شود</small></div>${window.authState?.member?.role==='admin'?`<button class="btn" onclick="editShareAmount()">✏️ تغییر مبلغ هر سهم</button>`:''}<button type="button" class="btn" data-action="add-member">➕ ساخت حساب و افزودن عضو</button><p class="muted">اطلاعات اعضا از اینجا قابل مدیریت است.</p><h3>اعضای فعال</h3>${state.members.map(m=>`<div class="list-item member-item"><div class="member-head"><div class="mini-avatar">${m.avatar_url?`<img src="${escapeAttr(m.avatar_url)}" alt="">`:(escapeHtml((m.name||'ع').slice(0,1)))}</div><b>${escapeHtml(m.name)}</b></div><p>تعهد صندوق: ${money(m.contribution_target)}</p><small>${m.role==='admin'?'👑 مدیر سفر':'👤 عضو'}</small>${window.authState?.member?.role==='admin'?`<div class="actions"><button class="btn small" onclick="editMember('${m.id}')">✏️ ویرایش پروفایل</button>${m.user_id!==window.authState?.session?.user?.id?`<button class="btn danger small" onclick="deleteMember('${m.id}','${escapeAttr(m.name)}')">🗑️ حذف</button>`:''}</div>`:''}</div>`).join('')||'<p class="muted">عضوی وجود ندارد.</p>'}`;
 } else if(page==='locations'){await loadLocations();title='📍 مکان‌های دیدنی';body=`<button class="btn" data-action="add-location">➕ پیشنهاد مکان جدید</button><p class="muted">هر عضو می‌تواند مکان پیشنهاد کند؛ مکان پیشنهادی پس از تأیید مدیر برای همه قابل استفاده است.</p>${state.locations.map(l=>{const st=l.status||'pending';const cls=st==='approved'?'approved':st==='rejected'?'danger':'pending';const actions=window.authState?.member?.role==='admin'&&st==='pending'?`<div class="actions"><button class="btn small" onclick="approveLocation('${l.id}')">✓ تأیید</button><button class="btn danger small" onclick="rejectLocation('${l.id}')">× رد</button></div>`:'';return `<div class="list-item"><span class="badge ${cls}">${statusFa(st)}</span><b>📍 ${escapeHtml(l.name)}</b>${l.category?`<p>دسته‌بندی: ${escapeHtml(l.category)}</p>`:''}${l.description?`<p>${escapeHtml(l.description)}</p>`:''}${l.suggested_duration_minutes?`<small>⏱️ حدود ${l.suggested_duration_minutes} دقیقه</small>`:''}${l.map_url?`<p><a href="${escapeAttr(l.map_url)}" target="_blank" rel="noopener">🗺️ مشاهده روی نقشه</a></p>`:''}${actions}</div>`}).join('')||'<div class="empty-state">هنوز مکانی پیشنهاد نشده است.</div>'}`;
 } else if(page==='itinerary'){title='🗺️ برنامه سفر';body=['۱۰:۰۰ — 📍 جواهرده','۱۴:۳۰ — 🍽️ ناهار','۱۷:۰۰ — 🌊 ساحل رامسر','۲۰:۰۰ — 🏠 بازگشت'].map(x=>`<div class="list-item" ${x.startsWith('📷')?'onclick="showPage(\'album\')"':''}><b>${x}</b></div>`).join('');
 } else if(page==='settlement'){title='💸 وضعیت مالی';body=`<div class="stat primary"><span>کل هزینه‌های تأییدشده</span><strong id="approvedTotal">در حال محاسبه...</strong></div><div id="financialMembers"></div>`;setTimeout(async()=>{const f=await loadFinancialSummary();const t=f?.trip||{};const el=document.querySelector('#financialMembers');const total=document.querySelector('#approvedTotal');if(total)total.textContent=money(t.approved_expenses);if(el)el.innerHTML=(f?.members||[]).map(m=>{const balance=Number(m.direct_paid||0)-Number(m.calculated_share||0);const st=balance>0?'طلبکار':balance<0?'بدهکار':'تسویه';const fundDebt=Math.max(0,Number(m.fund_claim||0));const paid=Number(m.approved_contributions||0);return `<div class="list-item"><b>${escapeHtml(m.name)}</b><span class="badge ${balance>0?'approved':balance<0?'pending':'approved'}">${st}</span><p>سهم هزینه: ${money(m.calculated_share)} • پرداخت شخصی: ${money(m.direct_paid)}</p><small>وضعیت صندوق: تعهد ${money(m.contribution_target)} • پرداخت ${money(paid)} • ${fundDebt?`بدهی ${money(fundDebt)}`:paid>Number(m.contribution_target||0)?`طلب ${money(paid-Number(m.contribution_target||0))}`:'تسویه'}</small><small>مانده هزینه‌ها: ${money(Math.abs(balance))}</small></div>`}).join('')||'<div class="empty-state">اطلاعات مالی وجود ندارد.</div>';},0);
 } else if(page==='album'){title='📷 آلبوم سفر';body=`<div class="album-toolbar"><p class="muted">اعضای فعال سفر می‌توانند عکس اضافه کنند، لایک کنند و نظر بگذارند.</p><button class="btn" onclick="uploadPhoto()">📤 آپلود عکس</button></div><div id="albumGrid" class="album-grid"><div class="empty-state">در حال بارگذاری آلبوم...</div></div>`; setTimeout(loadAlbum,0);
 } else if(page==='profile'){title='👤 پروفایل';const u=window.authState?.profile, m=window.authState?.member;body=`<div class="profile-card"><div class="profile-avatar">${u?.avatar_url?`<img src="${escapeAttr(u.avatar_url)}" alt="پروفایل">`:(escapeHtml((u?.display_name||state.user||'ق').slice(0,1)))}</div><button class="btn small" onclick="uploadProfilePhoto()">📷 ${u?.avatar_url?'تغییر عکس پروفایل':'افزودن عکس پروفایل'}</button><h3>${u?.display_name||state.user||'کاربر'}</h3><p>${u?.phone||'شماره موبایل ثبت نشده'}</p><p>${window.authState?.session?.user?.email||'ایمیل ثبت نشده'}</p><span class="badge ${m?.role==='admin'?'approved':'pending'}">${m?.role==='admin'?'👑 مدیر سفر':'👤 عضو سفر'}</span></div><div class="list-item"><b>🧳 سفر فعال</b><p>${window.authState?.trip?.title||state.trip}</p></div>${m?.role==='admin'?'<button class="btn" onclick="showPage(\'admin\')">👑 پنل مدیریت</button>':''}${window.authState?.session?'<button class="btn danger" onclick="logoutUser()">خروج از حساب</button>':'<button class="btn" onclick="showAuth()">ورود / ایجاد حساب</button>'}`;
} else if(page==='admin'){title='👑 پنل مدیریت';body=`<div class="admin-grid"><button onclick="showPage('members')">👥<b>اعضا</b><small>مدیریت اعضا</small></button><button onclick="showPage('pending')">🟡<b>تأیید هزینه‌ها</b><small>بررسی هزینه‌های جدید</small></button><button>📊<b>گزارش‌ها</b><small>Excel / PDF</small></button></div>`;
 } else {title='☰ امکانات بیشتر';body=['📷 آلبوم عکس','🎒 چک‌لیست سفر','🔔 اعلان‌ها','📊 گزارش‌ها و نمودارها','⚙️ تنظیمات'].map(x=>`<div class="list-item" ${x.startsWith('📷')?'onclick="showPage(\'album\')"':''}><b>${x}</b></div>`).join('')+(state.role==='admin'?`<div class="list-item" onclick="showPage('admin')"><b>👑 پنل مدیریت</b><p>مدیریت اعضا، تأییدها و سفرها</p></div>`:'');}
 const target=document.querySelector('#app'); if(target){target.innerHTML=`<button class="back-home" onclick="showPage('home')">← بازگشت به داشبورد</button><section class="page-panel"><h2>${title}</h2>${body}</section>`; window.scrollTo({top:0,behavior:'smooth'}); } }
window.closeModal=function closeModal(){modal().classList.add('hidden')}
window.approveExpense=async(id)=>{if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند تأیید کند.');const {error}=await window.sb.from('expenses').update({status:'approved',approved_by:window.authState.session.user.id,approved_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return;}await loadExpenses();showPage('pending');};
window.rejectExpense=async(id)=>{if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند رد کند.');const reason=prompt('دلیل رد هزینه (اختیاری):')||null;const {error}=await window.sb.from('expenses').update({status:'rejected',rejection_reason:reason}).eq('id',id);if(error){alert(error.message);return;}await loadExpenses();showPage('pending');};
async function loadMembershipRequests(){
 if(!window.authState?.tripId){state.pendingMembers=[];return []}
 const {data,error}=await window.sb.from('membership_requests').select('id,trip_id,user_id,full_name,phone,note,status,requested_at').eq('trip_id',window.authState.tripId).eq('status','pending').order('requested_at',{ascending:false});
 if(error){console.error('membership requests',error);state.pendingMembers=[];return []}
 state.pendingMembers=data||[];return state.pendingMembers;
}
window.approveMember=async(requestId)=>{
 const m=state.pendingMembers.find(x=>String(x.id)===String(requestId));
 if(!m)return alert('درخواست عضویت پیدا نشد.');
 modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>✓ تأیید عضویت</h2><div class="form"><label>نام عضو<input id="mn" value="${escapeHtml(m.full_name||'')}"></label><label>ضریب مشارکت<input id="mw" type="number" step="0.1" min="0.001" value="1"></label><label>سهم هدف صندوق<input id="mc" type="number" min="0" value="12000000"></label><button class="btn" onclick="activateMember('${m.id}')">✓ تأیید و فعال‌سازی</button></div></div>`;modal().classList.remove('hidden');
};
window.activateMember=async(requestId)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند اعضا را تأیید کند.');
 const n=$('#mn')?.value.trim(),w=Number($('#mw')?.value||1),c=Number($('#mc')?.value||0);
 const {error}=await window.sb.rpc('approve_membership_request',{p_request_id:Number(requestId),p_name:n,p_share_weight:w,p_contribution_target:c,p_role:'member'});
 if(error){alert('تأیید عضویت انجام نشد:\n'+error.message);return;}
 closeModal();await loadTripMembers();await showPage('members');
};
window.rejectMember=async(requestId)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند درخواست را رد کند.');
 const reason=prompt('دلیل رد درخواست (اختیاری):')||null;
 const {error}=await window.sb.rpc('reject_membership_request',{p_request_id:Number(requestId),p_reason:reason});
 if(error){alert('رد درخواست انجام نشد:\n'+error.message);return;}
 await showPage('members');
};
window.addMember=()=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند عضو اضافه کند.');
 const m=document.querySelector('#modal');
 if(!m)return alert('پنجره افزودن عضو پیدا نشد.');
 m.innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>➕ ساخت حساب و افزودن عضو</h2><p class="muted">ادمین می‌تواند حساب کاربری را بسازد و اطلاعات ورود را مستقیماً به عضو بدهد.</p><div class="form"><label>نام و نام خانوادگی<input id="an" autocomplete="name" required></label><label>نام کاربری<input id="au" autocomplete="username" placeholder="مثلاً mehdi123" required></label><label>رمز عبور<input id="apass" type="password" autocomplete="new-password" minlength="6" required></label><label>شماره موبایل (اختیاری)<input id="aph" type="tel" autocomplete="tel" placeholder="0912..."></label><label>تعداد سهم<input id="aw" type="number" step="0.5" min="0.5" value="1"></label><p class="muted">تعهد صندوق: <b id="memberTargetPreview">12,000,000 تومان</b></p><label>نقش<select id="ar"><option value="member">عضو سفر</option><option value="admin">مدیر سفر</option></select></label><button type="button" class="btn" data-action="save-member">ساخت حساب و افزودن عضو</button></div></div>`;
 m.classList.remove('hidden');
};
window.saveMember=async()=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند عضو اضافه کند.');
 const name=$('#an')?.value.trim(),username=$('#au')?.value.trim().toLowerCase(),password=$('#apass')?.value||'',phone=$('#aph')?.value.trim()||null,w=Number($('#aw')?.value||1),c=Math.round(w*Number(state.shareAmount||12000000)),role=$('#ar')?.value||'member';
 if(!name||!username||!password)return alert('نام، نام کاربری و رمز عبور را کامل وارد کنید.');
 if(password.length<6)return alert('رمز عبور باید حداقل ۶ کاراکتر باشد.');
 if(!window.authState?.tripId)return alert('ابتدا یک سفر را انتخاب کنید.');
 const btn=document.querySelector('[data-action="save-member"]');if(btn)btn.disabled=true;
 try{
  const {data,error}=await window.sb.functions.invoke('create-trip-member',{body:{trip_id:window.authState.tripId,name,username,password,phone,share_weight:w,contribution_target:c,role}});
  if(error)throw error;
  if(data?.error)throw new Error(data.error);
  closeModal();
  await loadTripMembers();
  await showPage('members');
  const m=document.querySelector('#modal');
  if(m){m.innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>✅ حساب ساخته شد</h2><div class="list-item"><b>👤 ${escapeHtml(name)}</b><p>نام کاربری: <strong>${escapeHtml(username)}</strong></p><p>رمز عبور: <strong>${escapeHtml(password)}</strong></p><p class="muted">این اطلاعات را برای عضو ارسال کنید.</p></div><button class="btn" onclick="navigator.clipboard?.writeText('نام: ${escapeHtml(name)}\nنام کاربری: ${escapeHtml(username)}\nرمز عبور: ${escapeHtml(password)}').then(()=>alert('اطلاعات ورود کپی شد.'))">📋 کپی اطلاعات ورود</button></div>`;m.classList.remove('hidden');}
 }catch(e){alert('ساخت حساب انجام نشد:\n'+(e.message||String(e)))}finally{if(btn)btn.disabled=false;}
};

window.editMember=async(id)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند پروفایل اعضا را ویرایش کند.');
 await loadTripMembers();
 const m=state.members.find(x=>Number(x.id)===Number(id)); if(!m)return alert('عضو پیدا نشد.');
 let phone=''; if(m.user_id){const {data:p}=await window.sb.from('profiles').select('phone').eq('user_id',m.user_id).maybeSingle(); phone=p?.phone||'';}
 const isSelf=m.user_id===window.authState?.session?.user?.id;
 modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>✏️ ویرایش پروفایل عضو</h2><div class="form"><label>نام و نام خانوادگی<input id="emName" value="${escapeAttr(m.name)}"></label><label>شماره موبایل<input id="emPhone" type="tel" value="${escapeAttr(phone)}"></label><label>تعداد سهم<input id="emWeight" type="number" min="0.5" step="0.5" value="${Number(m.share_weight)||1}"></label><label>نقش<select id="emRole" ${isSelf?'disabled':''}><option value="member" ${m.role==='member'?'selected':''}>عضو سفر</option><option value="admin" ${m.role==='admin'?'selected':''}>مدیر سفر</option></select></label><p class="muted">تعهد صندوق بر اساس مبلغ هر سهم به‌صورت خودکار محاسبه می‌شود.</p><button class="btn" onclick="saveMemberProfile('${m.id}',${isSelf})">💾 ذخیره تغییرات</button></div></div>`; modal().classList.remove('hidden');
};
window.saveMemberProfile=async(id,isSelf)=>{
 const name=$('#emName')?.value.trim(),phone=$('#emPhone')?.value.trim()||null,weight=Number($('#emWeight')?.value||0),role=isSelf?'admin':($('#emRole')?.value||'member');
 if(!name||!weight||weight<=0)return alert('نام و تعداد سهم را کامل وارد کنید.');
 const {error}=await window.sb.rpc('update_trip_member_profile',{p_member_id:Number(id),p_name:name,p_phone:phone,p_share_weight:weight,p_role:role});
 if(error){alert('ویرایش پروفایل انجام نشد: '+error.message);return;}
 alert('پروفایل عضو با موفقیت به‌روزرسانی شد.'); closeModal(); await showPage('members');
};
window.deleteMember=async(id,name)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند عضو حذف کند.');
 if(!confirm(`عضو «${name}» از این سفر حذف شود؟\nاطلاعات مالی و سوابق او برای حفظ محاسبات حذف نمی‌شود؛ فقط عضویت فعال او غیرفعال می‌شود.`))return;
 const {error}=await window.sb.from('trip_members').update({active:false}).eq('id',id).eq('trip_id',window.authState.tripId);
 if(error){alert('حذف عضو انجام نشد: '+error.message);return;}
 await loadTripMembers(); await showPage('members');
};
window.addLocation=()=>{
 if(!window.authState?.session)return showAuth();
 if(!window.authState?.tripId)return alert('ابتدا عضو سفر شوید.');
 modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>📍 پیشنهاد مکان</h2><p class="muted">این پیشنهاد برای تأیید مدیر ارسال می‌شود.</p><div class="form"><label>نام مکان<input id="ln" placeholder="مثلاً جواهرده" required></label><label>توضیحات<textarea id="ld" placeholder="توضیح اختیاری"></textarea></label><label>دسته‌بندی<input id="lc" placeholder="طبیعت، ساحل، تاریخی..."></label><label>مدت پیشنهادی (دقیقه)<input id="ldur" type="number" min="1"></label><label>لینک نقشه<input id="lm" type="url" placeholder="https://maps.google.com/..."></label><button class="btn" data-action="save-location">ارسال برای تأیید مدیر</button></div></div>`;modal().classList.remove('hidden');
};
window.saveLocation=async()=>{
 if(!window.authState?.session?.user?.id||!window.authState?.tripId)return showAuth();
 const name=$('#ln')?.value.trim(),description=$('#ld')?.value.trim()||null,category=$('#lc')?.value.trim()||null,duration=Number($('#ldur')?.value||0)||null,map_url=$('#lm')?.value.trim()||null;
 if(!name)return alert('نام مکان را وارد کنید.');
 const {error}=await window.sb.from('locations').insert({trip_id:window.authState.tripId,name,description,category,suggested_duration_minutes:duration,map_url,created_by:window.authState.session.user.id,submitted_by:window.authState.session.user.id,status:'pending'});
 if(error){alert('ثبت پیشنهاد مکان انجام نشد: '+error.message);return;}
 closeModal();alert('مکان برای تأیید مدیر ارسال شد.');await showPage('locations');
};
window.approveLocation=async(id)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند مکان را تأیید کند.');
 const {error}=await window.sb.from('locations').update({status:'approved',approved_by:window.authState.session.user.id,approved_at:new Date().toISOString(),rejection_reason:null}).eq('id',id).eq('trip_id',window.authState.tripId);
 if(error){alert('تأیید مکان انجام نشد: '+error.message);return;}
 await showPage('locations');
};
window.rejectLocation=async(id)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند مکان را رد کند.');
 const reason=prompt('دلیل رد مکان (اختیاری):')||null;
 const {error}=await window.sb.from('locations').update({status:'rejected',approved_by:window.authState.session.user.id,approved_at:new Date().toISOString(),rejection_reason:reason}).eq('id',id).eq('trip_id',window.authState.tripId);
 if(error){alert('رد مکان انجام نشد: '+error.message);return;}
 await showPage('locations');
};

window.newExpense=async()=>{
 if(!window.authState?.session){showAuth();return;}
 if(!window.authState?.tripId){alert('ابتدا عضو یک سفر شوید.');return;}
 try{await loadTripMembers();}catch(e){alert('اعضای سفر بارگذاری نشد: '+e.message);return;}
 const opts=state.members.map(m=>`<label class="check-row"><input type="checkbox" name="ep" value="${m.id}" checked><span>${escapeHtml(m.name)}</span></label>`).join('');
 const payers=state.members.map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
 modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>➕ ثبت هزینه جدید</h2><p class="muted">هزینه ابتدا برای تأیید مدیر ارسال می‌شود و تا قبل از تأیید در محاسبات مالی وارد نمی‌شود.</p><div class="form"><label>عنوان هزینه<input id="exTitle" placeholder="مثلاً خرید مواد غذایی"></label><label>مبلغ (تومان)<input id="exAmount" type="number" min="1" inputmode="numeric"></label><label>تاریخ<input id="exDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>دسته‌بندی<select id="exCat"><option value="food">غذا</option><option value="accommodation">اقامت</option><option value="transport">حمل‌ونقل</option><option value="fuel">سوخت</option><option value="shopping">خرید</option><option value="entertainment">تفریح</option><option value="sightseeing">گردش</option><option value="medical">پزشکی</option><option value="other">سایر</option></select></label><label>نحوه پرداخت<select id="exFromFund" onchange="togglePayerField()"><option value="true">از صندوق مشترک</option><option value="false">پرداخت شخصی</option></select></label><label id="payerWrap" class="hidden">پرداخت‌کننده<select id="exPayer">${payers}</select></label><label>توضیحات<textarea id="exNote" placeholder="توضیح اختیاری"></textarea></label><div><b>اعضای مشمول هزینه</b><p class="muted">همه اعضای فعال به‌صورت پیش‌فرض انتخاب شده‌اند؛ در صورت نیاز فقط انتخاب/حذف کنید.</p>${opts}</div><button class="btn" onclick="saveExpense()">ارسال برای تأیید مدیر</button></div></div>`;modal().classList.remove('hidden');};
window.togglePayerField=()=>{const w=document.querySelector('#payerWrap');const f=document.querySelector('#exFromFund');w?.classList.toggle('hidden',f?.value==='true');};
window.saveExpense=async()=>{const title=$('#exTitle')?.value.trim(),amount=Number($('#exAmount')?.value),date=$('#exDate')?.value||new Date().toISOString().slice(0,10),category=$('#exCat')?.value||'other',fromFund=$('#exFromFund')?.value==='true',payer=Number($('#exPayer')?.value||0)||null,note=$('#exNote')?.value.trim()||null,participants=[...document.querySelectorAll('input[name=ep]:checked')].map(x=>Number(x.value));if(!title||!amount||amount<=0){alert('عنوان و مبلغ را کامل وارد کنید.');return;}if(!participants.length){alert('حداقل یک عضو باید در هزینه سهیم باشد.');return;}if(!fromFund&&!payer){alert('پرداخت‌کننده را انتخاب کنید.');return;}const uid=window.authState.session.user.id;const payload={trip_id:window.authState.tripId,expense_date:date,title,category,amount,from_fund:fromFund,payer_member_id:fromFund?null:payer,note,submitted_by:uid,status:'pending'};const {data:expense,error}=await window.sb.from('expenses').insert(payload).select('id').single();if(error){alert('ثبت هزینه انجام نشد: '+error.message);return;}const rows=participants.map(trip_member_id=>({expense_id:expense.id,trip_member_id}));const {error:perr}=await window.sb.from('expense_participants').insert(rows);if(perr){await window.sb.from('expenses').delete().eq('id',expense.id);alert('ثبت افراد مشمول انجام نشد: '+perr.message);return;}alert('هزینه ثبت شد و در انتظار تأیید مدیر است.');closeModal();await loadExpenses();showPage('expenses');};
window.editShareAmount=async()=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند مبلغ هر سهم را تغییر دهد.');
 await loadTripSettings();
 const raw=prompt('مبلغ هر سهم (تومان):',String(state.shareAmount||12000000));
 if(raw===null)return;
 const amount=Number(String(raw).replace(/,/g,'').trim());
 if(!Number.isFinite(amount)||amount<=0)return alert('مبلغ واردشده معتبر نیست.');
 if(!confirm(`مبلغ هر سهم به ${money(amount)} تغییر کند؟\nتعهد صندوق همه اعضا نیز بر اساس تعداد سهم دوباره محاسبه می‌شود.`))return;
 const {error}=await window.sb.rpc('set_trip_share_amount',{p_trip_id:window.authState.tripId,p_share_amount:Math.round(amount)});
 if(error){alert('تغییر مبلغ هر سهم انجام نشد: '+error.message);return;}
 state.shareAmount=Math.round(amount);
 alert('مبلغ هر سهم و تعهد اعضا به‌روزرسانی شد.');
 await showPage('members');
};

window.newContribution=async()=>{
 if(!window.authState?.session){showAuth();return;}
 if(!window.authState?.tripId){alert('ابتدا عضو سفر شوید.');return;}
 await loadTripMembers();
 const members=state.members.filter(m=>m.active!==false);
 const opts=members.map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
 modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>➕ ثبت واریزی به صندوق</h2><p class="muted">واریزی پس از ثبت، برای تأیید مدیر ارسال می‌شود و فقط بعد از تأیید وارد موجودی صندوق خواهد شد.</p><div class="form"><label>واریزکننده<select id="fcMember">${opts}</select></label><label>مبلغ (تومان)<input id="fcAmount" type="number" min="1" inputmode="numeric" placeholder="مثلاً 5000000"></label><label>تاریخ واریز<input id="fcDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>روش پرداخت<select id="fcMethod"><option value="cash">نقدی</option><option value="card">کارت</option><option value="bank_transfer">کارت به کارت / انتقال بانکی</option><option value="other">سایر</option></select></label><label>توضیحات<textarea id="fcNote" placeholder="توضیح اختیاری"></textarea></label><button class="btn" onclick="saveContribution()">ارسال برای تأیید مدیر</button></div></div>`;
 modal().classList.remove('hidden');
};
window.saveContribution=async()=>{
 const memberId=Number($('#fcMember')?.value||0),amount=Number($('#fcAmount')?.value||0),date=$('#fcDate')?.value||new Date().toISOString().slice(0,10),method=$('#fcMethod')?.value||'cash',note=$('#fcNote')?.value.trim()||null;
 if(!memberId||!amount||amount<=0){alert('واریزکننده و مبلغ را کامل وارد کنید.');return;}
 const uid=window.authState?.session?.user?.id;
 const tripId=window.authState?.tripId;
 const {error}=await window.sb.from('fund_contributions').insert({trip_id:tripId,trip_member_id:memberId,amount,method,contribution_date:date,status:'pending',submitted_by:uid,note});
 if(error){alert('ثبت واریزی انجام نشد: '+error.message);return;}
 alert('واریزی ثبت شد و در انتظار تأیید مدیر است.');closeModal();await showPage('fund');
};
window.loadContributions=async()=>{
 if(!window.authState?.tripId)return [];
 const {data,error}=await window.sb.from('fund_contributions').select('id,trip_member_id,amount,method,contribution_date,status,submitted_by,note,created_at').eq('trip_id',window.authState.tripId).order('created_at',{ascending:false});
 if(error){console.error('contributions',error);return [];} return data||[];
};
window.approveContribution=async(id)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند واریزی را تأیید کند.');
 const {error}=await window.sb.from('fund_contributions').update({status:'approved',approved_by:window.authState.session.user.id,approved_at:new Date().toISOString(),rejection_reason:null}).eq('id',id).eq('trip_id',window.authState.tripId);
 if(error){alert('تأیید واریزی انجام نشد: '+error.message);return;} await showPage('fund');
};
window.rejectContribution=async(id)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند واریزی را رد کند.');
 const reason=prompt('دلیل رد واریزی (اختیاری):')||null;
 const {error}=await window.sb.from('fund_contributions').update({status:'rejected',approved_by:window.authState.session.user.id,approved_at:new Date().toISOString(),rejection_reason:reason}).eq('id',id).eq('trip_id',window.authState.tripId);
 if(error){alert('رد واریزی انجام نشد: '+error.message);return;} await showPage('fund');
};window.newTrip=()=>{const m=document.querySelector('#modal');m.innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>🧳 ایجاد سفر جدید</h2><div class="form"><label>عنوان سفر<input id="ntTitle" placeholder="مثلاً سفر شمال ۱۴۰۵"></label><label>مقصد<input id="ntDest" placeholder="شمال ایران"></label><label>تاریخ شروع<input id="ntStart" type="date"></label><label>تاریخ پایان<input id="ntEnd" type="date"></label><label>موجودی اولیه صندوق<input id="ntFund" type="number" value="0"></label><label>نام مدیر<input id="ntName" value="${window.authState?.profile?.display_name||''}"></label><label>مبلغ هر سهم<input id="ntShareAmount" type="number" value="12000000"></label><button class="btn" onclick="createTrip()">ایجاد سفر و مدیر شدن</button></div></div>`;m.classList.remove('hidden')};
window.createTrip=async()=>{if(!window.authState?.session){showAuth();return;}const g=id=>document.getElementById(id)?.value||null;const {data,error}=await window.sb.rpc('create_trip_with_admin',{p_title:g('ntTitle'),p_destination:g('ntDest'),p_start_date:g('ntStart')||null,p_end_date:g('ntEnd')||null,p_opening_fund:Number(g('ntFund')||0),p_name:g('ntName'),p_phone:window.authState.profile?.phone||null,p_share_weight:1,p_contribution_target:Number(g('ntShareAmount')||12000000)});if(error){alert(error.message);return;}alert('سفر با موفقیت ایجاد شد و شما مدیر سفر شدید.');location.href=location.pathname;};
window.copyInvite=async()=>{if(!window.authState?.tripId){alert('ابتدا یک سفر ایجاد یا انتخاب کنید.');return;}const {data,error}=await window.sb.rpc('create_trip_invite',{p_trip_id:window.authState.tripId,p_expires_at:null});if(error){alert(error.message);return;}const url=location.origin+location.pathname+'?join='+data;try{await navigator.clipboard.writeText(url);alert('لینک دعوت کپی شد.');}catch(e){prompt('لینک دعوت:',url)}}
window.refreshAppAuth=()=>{const a=document.querySelector('.avatar');if(!a)return;a.textContent=window.authState?.session?'✓':'ق';};
window.showAccount=()=>{const m=document.querySelector('#modal');const u=window.authState?.profile;m.innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>👤 حساب کاربری</h2><div class="profile-card"><div class="profile-avatar">${u?.avatar_url?`<img src="${escapeAttr(u.avatar_url)}" alt="پروفایل">`:(escapeHtml((u?.display_name||'ک').slice(0,1)))}</div><button class="btn small" onclick="uploadProfilePhoto()">📷 ${u?.avatar_url?'تغییر عکس':'افزودن عکس پروفایل'}</button><div class="list-item"><b>${u?.display_name||'کاربر'}</b><p>${u?.phone||''}</p><p>${window.authState?.member?.role==='admin'?'👑 مدیر سفر':'👤 عضو سفر'}</p></div></div><button class="btn danger" onclick="logoutUser()">خروج از حساب</button></div>`;m.classList.remove('hidden');};
window.uploadProfilePhoto=async()=>{if(!window.authState?.session)return showAuth();const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;if(file.size>5*1024*1024)return alert('حداکثر حجم عکس پروفایل ۵ مگابایت است.');if(!file.type.startsWith('image/'))return alert('فقط فایل تصویری انتخاب کنید.');const uid=window.authState.session.user.id;const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=`${uid}/avatar.${ext}`;const {error:up}=await window.sb.storage.from('profile-photos').upload(path,file,{upsert:true,contentType:file.type});if(up)return alert('آپلود عکس انجام نشد: '+up.message);const {data:pub}=window.sb.storage.from('profile-photos').getPublicUrl(path);const {error}=await window.sb.from('profiles').update({avatar_url:pub.publicUrl}).eq('user_id',uid);if(error)return alert('ذخیره عکس پروفایل انجام نشد: '+error.message);window.authState.profile={...(window.authState.profile||{}),avatar_url:pub.publicUrl};const a=document.querySelector('.avatar');if(a)a.innerHTML=`<img src="${escapeAttr(pub.publicUrl)}" alt="">`;closeModal();await showPage('profile');};input.click();};


window.uploadPhoto=async()=>{
 if(!window.authState?.session){showAuth();return;}
 if(!window.authState?.tripId){alert('ابتدا عضو یک سفر شوید.');return;}
 const input=document.createElement('input'); input.type='file'; input.accept='image/*';
 input.onchange=async()=>{
  const file=input.files?.[0]; if(!file)return;
  if(file.size>8*1024*1024){alert('حداکثر حجم عکس ۸ مگابایت است.');return;}
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`${window.authState.tripId}/${crypto.randomUUID()}.${ext}`;
  const {error:up}=await window.sb.storage.from('trip-photos').upload(path,file,{upsert:false,contentType:file.type||'image/jpeg'});
  if(up){alert('آپلود عکس انجام نشد: '+up.message);return;}
  const {error}=await window.sb.from('album_photos').insert({trip_id:window.authState.tripId,uploaded_by:window.authState.session.user.id,storage_path:path,caption:''});
  if(error){await window.sb.storage.from('trip-photos').remove([path]);alert('ثبت عکس انجام نشد: '+error.message);return;}
  loadAlbum(); loadHomeAlbum();
 };
 input.click();
};
window.togglePhotoLike=async(photoId)=>{
 if(!window.authState?.session){showAuth();return;}
 const uid=window.authState.session.user.id;
 const {data:existing,error:readErr}=await window.sb.from('photo_likes').select('id').eq('photo_id',photoId).eq('user_id',uid).maybeSingle();
 if(readErr){alert(readErr.message);return;}
 if(existing){const {error}=await window.sb.from('photo_likes').delete().eq('id',existing.id);if(error){alert(error.message);return;}}
 else{const {error}=await window.sb.from('photo_likes').insert({photo_id:photoId,user_id:uid});if(error){alert(error.message);return;}}
 loadAlbum(); loadHomeAlbum();
};
window.addPhotoComment=async(photoId)=>{
 if(!window.authState?.session){showAuth();return;}
 const text=prompt('نظر شما:'); if(!text?.trim())return;
 const clean=text.trim().slice(0,1000);
 const {error}=await window.sb.from('photo_comments').insert({photo_id:photoId,user_id:window.authState.session.user.id,comment:clean});
 if(error){alert(error.message);return;} loadAlbum(); loadHomeAlbum();
};
async function fetchAlbumData(limit=6){
 if(!window.authState?.tripId)return {photos:[],likes:[],comments:[],profiles:[]};
 let q=window.sb.from('album_photos').select('id,trip_id,uploaded_by,storage_path,caption,created_at').eq('trip_id',window.authState.tripId).order('created_at',{ascending:false});
 if(limit)q=q.limit(limit);
 const {data:photos,error}=await q;
 if(error)throw error;
 const list=photos||[], ids=list.map(p=>p.id);
 if(!ids.length)return {photos:list,likes:[],comments:[],profiles:[]};
 const userIds=[...new Set(list.map(p=>p.uploaded_by).filter(Boolean))];
 const [lr,cr,pr]=await Promise.all([
  window.sb.from('photo_likes').select('id,photo_id,user_id').in('photo_id',ids),
  window.sb.from('photo_comments').select('id,photo_id,user_id,comment,created_at').in('photo_id',ids).order('created_at',{ascending:true}),
  userIds.length?window.sb.from('profiles').select('user_id,display_name').in('user_id',userIds):Promise.resolve({data:[],error:null})
 ]);
 if(lr.error)throw lr.error;if(cr.error)throw cr.error;
 return {photos:list,likes:lr.data||[],comments:cr.data||[],profiles:pr.data||[]};
}
function renderPhotoCards(list,likeRows,commentRows,profileRows,compact=false){
 const profileMap=Object.fromEntries((profileRows||[]).map(x=>[x.user_id,x.display_name]));
 const uid=window.authState?.session?.user?.id;
 const photoUrl=p=>window.sb.storage.from('trip-photos').getPublicUrl(p.storage_path).data.publicUrl;
 return list.map(ph=>{
  const phLikes=likeRows.filter(x=>x.photo_id===ph.id);
  const allComments=commentRows.filter(x=>x.photo_id===ph.id);
  const phComments=allComments.slice(-3);
  const liked=phLikes.some(x=>x.user_id===uid);
  return `<article class="photo-card ${compact?'compact':''}"><img src="${escapeAttr(photoUrl(ph))}" loading="lazy" alt="عکس سفر" onclick="openPhoto('${ph.id}')"><div class="photo-meta"><b>${escapeHtml(profileMap[ph.uploaded_by]||'عضو سفر')}</b><div class="photo-actions"><button class="icon-btn ${liked?'liked':''}" onclick="togglePhotoLike('${ph.id}')">♥ ${phLikes.length}</button><button class="icon-btn" onclick="addPhotoComment('${ph.id}')">💬 ${allComments.length}</button></div></div>${ph.caption?`<p>${escapeHtml(ph.caption)}</p>`:''}<div class="comments">${phComments.map(c=>`<div><b>${escapeHtml(profileMap[c.user_id]||'عضو')}:</b> ${escapeHtml(c.comment)}</div>`).join('')}</div></article>`;
 }).join('');
}
window.loadHomeAlbum=async()=>{
 const grid=document.querySelector('#homeAlbumGrid');if(!grid)return;
 if(!window.authState?.session||!window.authState?.tripId){grid.innerHTML='<div class="empty-state">برای دیدن آلبوم وارد حساب شوید و عضو سفر باشید.</div>';return;}
 try{const d=await fetchAlbumData(6);if(!d.photos.length){grid.innerHTML='<div class="empty-state">هنوز عکسی در آلبوم نیست. اولین عکس را اضافه کنید 📸</div>';return;}grid.innerHTML=renderPhotoCards(d.photos,d.likes,d.comments,d.profiles,true);}catch(e){grid.innerHTML=`<div class="empty-state">خطا در بارگذاری آلبوم.<br><small>${escapeHtml(e.message)}</small></div>`;}
};
window.openPhoto=async(photoId)=>{
 if(!window.authState?.tripId)return;
 try{const d=await fetchAlbumData(null);const ph=d.photos.find(x=>x.id===photoId);if(!ph)return;const url=window.sb.storage.from('trip-photos').getPublicUrl(ph.storage_path).data.publicUrl;const profile=Object.fromEntries((d.profiles||[]).map(x=>[x.user_id,x.display_name]));const likes=d.likes.filter(x=>x.photo_id===ph.id),comments=d.comments.filter(x=>x.photo_id===ph.id);modal().innerHTML=`<div class="lightbox" onclick="if(event.target===this)closeModal()"><div class="lightbox-card"><button class="close" onclick="closeModal()">×</button><img src="${escapeAttr(url)}" alt="عکس سفر"><div class="photo-meta"><b>${escapeHtml(profile[ph.uploaded_by]||'عضو سفر')}</b><div class="photo-actions"><button class="icon-btn" onclick="togglePhotoLike('${ph.id}')">♥ ${likes.length}</button><button class="icon-btn" onclick="addPhotoComment('${ph.id}')">💬 ${comments.length}</button></div></div>${ph.caption?`<p>${escapeHtml(ph.caption)}</p>`:''}</div></div>`;modal().classList.remove('hidden');}catch(e){alert('نمایش عکس انجام نشد: '+e.message);}
};
window.loadAlbum=async()=>{
 const grid=document.querySelector('#albumGrid');if(!grid)return;
 if(!window.authState?.session||!window.authState?.tripId){grid.innerHTML='<div class="empty-state">برای دیدن آلبوم ابتدا وارد حساب شوید و عضو سفر باشید.</div>';return;}
 try{const d=await fetchAlbumData(null);if(!d.photos.length){grid.innerHTML='<div class="empty-state">هنوز عکسی در آلبوم نیست. اولین عکس را شما اضافه کنید 📸</div>';return;}grid.innerHTML=renderPhotoCards(d.photos,d.likes,d.comments,d.profiles,false);}catch(e){grid.innerHTML=`<div class="empty-state">خطا در بارگذاری آلبوم.<br><small>${escapeHtml(e.message)}</small></div>`;}
};
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function escapeAttr(v){return escapeHtml(v);}

document.addEventListener('click',e=>{
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='add-member'){e.preventDefault();window.addMember?.();return;}
 if(action==='save-member'){e.preventDefault();window.saveMember?.();return;}
 if(action==='add-location'){e.preventDefault();window.addLocation?.();return;}
 if(action==='save-location'){e.preventDefault();window.saveLocation?.();return;}
 const b=e.target.closest('[data-page]');if(b){e.preventDefault();showPage(b.dataset.page);return;}
 if(e.target===modal())closeModal();
});renderPending();setTimeout(loadExpenses,500);setTimeout(loadHomeAlbum,800);
