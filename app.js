const APP_VERSION = "11.7";
const state={role:'admin',user:'قاسم',trip:'سفر شمال ۱۴۰۵',pendingMembers:[],members:[],expenses:[]};
const $=s=>document.querySelector(s); let modal=()=>document.querySelector('#modal');
const money=n=>new Intl.NumberFormat('fa-IR').format(Number(n)||0)+' تومان';
const statusFa=s=>({pending:'در انتظار',approved:'تأیید شده',rejected:'رد شده'}[s]||s||'در انتظار');
async function loadTripMembers(){
 if(!window.authState?.tripId)return [];
 const {data,error}=await window.sb.from('trip_members').select('id,name,role,share_weight,contribution_target,active').eq('trip_id',window.authState.tripId).eq('active',true).order('created_at');
 if(error)throw error; state.members=data||[]; return state.members;
}
async function loadExpenses(){
 const grid=document.querySelector('#pendingPreview');
 if(!window.authState?.tripId){if(grid)grid.innerHTML='<div class="empty-state">برای مشاهده هزینه‌ها وارد حساب شوید و عضو سفر باشید.</div>';return [];}
 const {data,error}=await window.sb.from('expenses').select('id,trip_id,expense_date,title,category,amount,from_fund,payer_member_id,status,submitted_by,note,created_at').eq('trip_id',window.authState.tripId).order('created_at',{ascending:false});
 if(error){console.error(error);return [];}
 state.expenses=data||[]; renderPending(); return state.expenses;
}
async function loadFinancialSummary(){
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
 } else if(page==='fund'){title='🏦 صندوق';body=`<div class="stat primary"><span>موجودی فعلی صندوق</span><strong>۵۸,۵۰۰,۰۰۰</strong><small>تومان</small></div><div class="stat" style="margin-top:10px"><span>📥 مطالبات صندوق</span><strong>۵,۰۰۰,۰۰۰</strong><small>تومان</small></div><button class="btn" onclick="newContribution()">➕ ثبت واریزی به صندوق</button><div class="list-item"><b>تراکنش‌های اخیر</b><p>➕ واریزی تأییدشده محمد — ۱۲,۰۰۰,۰۰۰</p><p>➖ خرید گوشت از صندوق — ۳۰,۰۰۰,۰۰۰</p></div>`;
 } else if(page==='members'){await loadTripMembers();await loadMembershipRequests();title='👥 اعضای سفر';body=`<button type="button" class="btn" data-action="add-member">➕ افزودن عضو توسط ادمین</button><div class="list-item"><b>🔗 لینک دعوت اعضا</b><p>این لینک را برای اعضای جدید ارسال کنید.</p><button class="btn secondary" onclick="copyInvite()">کپی لینک دعوت</button></div><h3>درخواست‌های عضویت</h3>${state.pendingMembers.map((m)=>`<div class="list-item"><span class="badge pending">در انتظار</span><b>${escapeHtml(m.full_name||'کاربر')}</b><p>${escapeHtml(m.phone||'')} • ${m.requested_at?new Date(m.requested_at).toLocaleDateString('fa-IR'):''}</p><div class="actions"><button class="btn small" onclick="approveMember('${m.id}')">✓ بررسی و تأیید</button><button class="btn danger small" onclick="rejectMember('${m.id}')">× رد</button></div></div>`).join('')||'<p class="muted">درخواستی وجود ندارد.</p>'}<h3>اعضای فعال</h3>${state.members.map(m=>`<div class="list-item"><b>${escapeHtml(m.name)}</b><p>ضریب مشارکت: ${m.share_weight} • سهم صندوق: ${money(m.contribution_target)}</p><small>${m.role==='admin'?'👑 مدیر سفر':'👤 عضو'}</small></div>`).join('')||'<p class="muted">عضوی وجود ندارد.</p>'}`;
 } else if(page==='polls'){title='🗳️ رأی‌گیری';body=`<div class="poll-card"><div class="poll-title"><b>فردا کجا برویم؟</b><span>فعال</span></div>${['🌲 جواهرده','🌿 جنگل دالخانی','🌊 رامسر'].map((x,i)=>`<div class="poll-option"><span>${x}</span><b>${[6,4,2][i]} رأی</b></div><div class="bar"><i style="width:${[50,33,17][i]}%"></i></div>`).join('')}<button class="btn">ثبت رأی من</button></div>`;
 } else if(page==='locations'){title='📍 مکان‌های دیدنی';body=['جواهرده','جنگل دالخانی','ساحل رامسر'].map(x=>`<div class="list-item"><b>📍 ${x}</b><p>مکان پیشنهادی سفر</p><button class="btn">پیشنهاد برای رأی‌گیری</button></div>`).join('');
 } else if(page==='itinerary'){title='🗺️ برنامه سفر';body=['۱۰:۰۰ — 📍 جواهرده','۱۴:۳۰ — 🍽️ ناهار','۱۷:۰۰ — 🌊 ساحل رامسر','۲۰:۰۰ — 🏠 بازگشت'].map(x=>`<div class="list-item" ${x.startsWith('📷')?'onclick="showPage(\'album\')"':''}><b>${x}</b></div>`).join('');
 } else if(page==='settlement'){title='💸 سهم و وضعیت مالی';body=`<div class="stat primary"><span>کل هزینه‌های تأییدشده</span><strong id="approvedTotal">در حال محاسبه...</strong></div><div id="financialMembers"></div>`;setTimeout(async()=>{const f=await loadFinancialSummary();const t=f?.trip||{};const el=document.querySelector('#financialMembers');const total=document.querySelector('#approvedTotal');if(total)total.textContent=money(t.approved_expenses);if(el)el.innerHTML=(f?.members||[]).map(m=>{const balance=Number(m.direct_paid||0)-Number(m.calculated_share||0);const st=balance>0?'طلبکار':balance<0?'بدهکار':'تسویه';return `<div class="list-item"><b>${escapeHtml(m.name)}</b><span class="badge ${balance>0?'approved':balance<0?'pending':'approved'}">${st}</span><p>سهم هزینه: ${money(m.calculated_share)} • پرداخت شخصی: ${money(m.direct_paid)}</p><small>مانده: ${money(Math.abs(balance))}</small></div>`}).join('')||'<div class="empty-state">اطلاعات مالی وجود ندارد.</div>';},0);
 } else if(page==='album'){title='📷 آلبوم سفر';body=`<div class="album-toolbar"><p class="muted">اعضای فعال سفر می‌توانند عکس اضافه کنند، لایک کنند و نظر بگذارند.</p><button class="btn" onclick="uploadPhoto()">📤 آپلود عکس</button></div><div id="albumGrid" class="album-grid"><div class="empty-state">در حال بارگذاری آلبوم...</div></div>`; setTimeout(loadAlbum,0);
 } else if(page==='profile'){title='👤 پروفایل';const u=window.authState?.profile, m=window.authState?.member;body=`<div class="profile-card"><div class="profile-avatar">${(u?.display_name||state.user||'ق').slice(0,1)}</div><h3>${u?.display_name||state.user||'کاربر'}</h3><p>${u?.phone||'شماره موبایل ثبت نشده'}</p><p>${window.authState?.session?.user?.email||'ایمیل ثبت نشده'}</p><span class="badge ${m?.role==='admin'?'approved':'pending'}">${m?.role==='admin'?'👑 مدیر سفر':'👤 عضو سفر'}</span></div><div class="list-item"><b>🧳 سفر فعال</b><p>${window.authState?.trip?.title||state.trip}</p></div>${m?.role==='admin'?'<button class="btn" onclick="showPage(\'admin\')">👑 پنل مدیریت</button>':''}${window.authState?.session?'<button class="btn danger" onclick="logoutUser()">خروج از حساب</button>':'<button class="btn" onclick="showAuth()">ورود / ایجاد حساب</button>'}`;
} else if(page==='admin'){title='👑 پنل مدیریت';body=`<div class="admin-grid"><button onclick="showPage('members')">👥<b>اعضا</b><small>عضویت و ضرایب</small></button><button onclick="showPage('pending')">🟡<b>درخواست‌ها</b><small>تأیید هزینه‌ها</small></button><button onclick="newTrip()">🧳<b>سفر جدید</b><small>ایجاد سفر مستقل</small></button><button>📊<b>گزارش‌ها</b><small>Excel / PDF</small></button></div>`;
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
 closeModal();await loadTripMembers();await loadMembershipRequests();await showPage('members');
};
window.rejectMember=async(requestId)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند درخواست را رد کند.');
 const reason=prompt('دلیل رد درخواست (اختیاری):')||null;
 const {error}=await window.sb.rpc('reject_membership_request',{p_request_id:Number(requestId),p_reason:reason});
 if(error){alert('رد درخواست انجام نشد:\n'+error.message);return;}
 await loadMembershipRequests();await showPage('members');
};
window.addMember=()=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند عضو اضافه کند.');
 const m=document.querySelector('#modal');
 if(!m)return alert('پنجره افزودن عضو پیدا نشد. صفحه را یک‌بار بازخوانی کنید.');
 m.innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>➕ افزودن عضو</h2><p class="muted">کاربر باید قبلاً در برنامه حساب ساخته باشد. شماره موبایل را دقیقاً همان‌طور که در پروفایل ثبت شده وارد کنید.</p><div class="form"><label>نام و نام خانوادگی (اختیاری)<input id="an" autocomplete="name"></label><label>شماره موبایل<input id="ap" type="tel" autocomplete="tel" placeholder="مثلاً 0912..." required></label><label>ضریب مشارکت<input id="aw" type="number" step="0.1" min="0.001" value="1"></label><label>سهم هدف صندوق<input id="ac" type="number" min="0" value="12000000"></label><button type="button" class="btn" data-action="save-member">افزودن عضو</button></div></div>`;
 m.classList.remove('hidden');
};
window.saveMember=async()=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند عضو اضافه کند.');
 const phone=$('#ap')?.value.trim(),name=$('#an')?.value.trim()||null,w=Number($('#aw')?.value||1),c=Number($('#ac')?.value||0);
 if(!phone)return alert('شماره موبایل را وارد کنید.');
 if(!window.authState?.tripId)return alert('ابتدا یک سفر را انتخاب کنید.');
 const {error}=await window.sb.rpc('add_trip_member_by_phone',{p_trip_id:window.authState.tripId,p_phone:phone,p_name:name,p_share_weight:w,p_contribution_target:c});
 if(error){alert('افزودن عضو انجام نشد:\n'+error.message+'\n\nاگر این شماره هنوز حساب کاربری ندارد، از «کپی لینک دعوت» استفاده کنید.');return;}
 alert('عضو با موفقیت به سفر اضافه شد.');closeModal();await loadTripMembers();await showPage('members');
};

window.newExpense=async()=>{
 if(!window.authState?.session){showAuth();return;}
 if(!window.authState?.tripId){alert('ابتدا عضو یک سفر شوید.');return;}
 try{await loadTripMembers();}catch(e){alert('اعضای سفر بارگذاری نشد: '+e.message);return;}
 const opts=state.members.map(m=>`<label class="check-row"><input type="checkbox" name="ep" value="${m.id}" checked><span>${escapeHtml(m.name)} <small>(ضریب ${m.share_weight})</small></span></label>`).join('');
 const payers=state.members.map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
 modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>➕ ثبت هزینه جدید</h2><p class="muted">هزینه ابتدا برای تأیید مدیر ارسال می‌شود و تا قبل از تأیید در محاسبات مالی وارد نمی‌شود.</p><div class="form"><label>عنوان هزینه<input id="exTitle" placeholder="مثلاً خرید مواد غذایی"></label><label>مبلغ (تومان)<input id="exAmount" type="number" min="1" inputmode="numeric"></label><label>تاریخ<input id="exDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>دسته‌بندی<select id="exCat"><option value="food">غذا</option><option value="accommodation">اقامت</option><option value="transport">حمل‌ونقل</option><option value="fuel">سوخت</option><option value="shopping">خرید</option><option value="entertainment">تفریح</option><option value="sightseeing">گردش</option><option value="medical">پزشکی</option><option value="other">سایر</option></select></label><label>نحوه پرداخت<select id="exFromFund" onchange="togglePayerField()"><option value="true">از صندوق مشترک</option><option value="false">پرداخت شخصی</option></select></label><label id="payerWrap" class="hidden">پرداخت‌کننده<select id="exPayer">${payers}</select></label><label>توضیحات<textarea id="exNote" placeholder="توضیح اختیاری"></textarea></label><div><b>اعضای مشمول هزینه</b><p class="muted">ضریب مشارکت هر عضو از تنظیمات سفر خوانده می‌شود.</p>${opts}</div><button class="btn" onclick="saveExpense()">ارسال برای تأیید مدیر</button></div></div>`;modal().classList.remove('hidden');};
window.togglePayerField=()=>{const w=document.querySelector('#payerWrap');const f=document.querySelector('#exFromFund');w?.classList.toggle('hidden',f?.value==='true');};
window.saveExpense=async()=>{const title=$('#exTitle')?.value.trim(),amount=Number($('#exAmount')?.value),date=$('#exDate')?.value||new Date().toISOString().slice(0,10),category=$('#exCat')?.value||'other',fromFund=$('#exFromFund')?.value==='true',payer=Number($('#exPayer')?.value||0)||null,note=$('#exNote')?.value.trim()||null,participants=[...document.querySelectorAll('input[name=ep]:checked')].map(x=>Number(x.value));if(!title||!amount||amount<=0){alert('عنوان و مبلغ را کامل وارد کنید.');return;}if(!participants.length){alert('حداقل یک عضو باید در هزینه سهیم باشد.');return;}if(!fromFund&&!payer){alert('پرداخت‌کننده را انتخاب کنید.');return;}const uid=window.authState.session.user.id;const payload={trip_id:window.authState.tripId,expense_date:date,title,category,amount,from_fund:fromFund,payer_member_id:fromFund?null:payer,note,submitted_by:uid,status:'pending'};const {data:expense,error}=await window.sb.from('expenses').insert(payload).select('id').single();if(error){alert('ثبت هزینه انجام نشد: '+error.message);return;}const rows=participants.map(trip_member_id=>({expense_id:expense.id,trip_member_id}));const {error:perr}=await window.sb.from('expense_participants').insert(rows);if(perr){await window.sb.from('expenses').delete().eq('id',expense.id);alert('ثبت افراد مشمول انجام نشد: '+perr.message);return;}alert('هزینه ثبت شد و در انتظار تأیید مدیر است.');closeModal();await loadExpenses();showPage('expenses');};
window.newContribution=()=>alert('مرحله بعد: ثبت واقعی واریزی صندوق به Supabase.');window.newTrip=()=>{const m=document.querySelector('#modal');m.innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>🧳 ایجاد سفر جدید</h2><div class="form"><label>عنوان سفر<input id="ntTitle" placeholder="مثلاً سفر شمال ۱۴۰۵"></label><label>مقصد<input id="ntDest" placeholder="شمال ایران"></label><label>تاریخ شروع<input id="ntStart" type="date"></label><label>تاریخ پایان<input id="ntEnd" type="date"></label><label>موجودی اولیه صندوق<input id="ntFund" type="number" value="0"></label><label>نام مدیر<input id="ntName" value="${window.authState?.profile?.display_name||''}"></label><label>سهم هدف صندوق مدیر<input id="ntContrib" type="number" value="0"></label><button class="btn" onclick="createTrip()">ایجاد سفر و مدیر شدن</button></div></div>`;m.classList.remove('hidden')};
window.createTrip=async()=>{if(!window.authState?.session){showAuth();return;}const g=id=>document.getElementById(id)?.value||null;const {data,error}=await window.sb.rpc('create_trip_with_admin',{p_title:g('ntTitle'),p_destination:g('ntDest'),p_start_date:g('ntStart')||null,p_end_date:g('ntEnd')||null,p_opening_fund:Number(g('ntFund')||0),p_name:g('ntName'),p_phone:window.authState.profile?.phone||null,p_share_weight:1,p_contribution_target:Number(g('ntContrib')||0)});if(error){alert(error.message);return;}alert('سفر با موفقیت ایجاد شد و شما مدیر سفر شدید.');location.href=location.pathname;};
window.copyInvite=async()=>{if(!window.authState?.tripId){alert('ابتدا یک سفر ایجاد یا انتخاب کنید.');return;}const {data,error}=await window.sb.rpc('create_trip_invite',{p_trip_id:window.authState.tripId,p_expires_at:null});if(error){alert(error.message);return;}const url=location.origin+location.pathname+'?join='+data;try{await navigator.clipboard.writeText(url);alert('لینک دعوت کپی شد.');}catch(e){prompt('لینک دعوت:',url)}}
window.refreshAppAuth=()=>{const a=document.querySelector('.avatar');if(!a)return;a.textContent=window.authState?.session?'✓':'ق';};
window.showAccount=()=>{const m=document.querySelector('#modal');const u=window.authState?.profile;m.innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>👤 حساب کاربری</h2><div class="list-item"><b>${u?.display_name||'کاربر'}</b><p>${u?.phone||''}</p><p>${window.authState?.member?.role==='admin'?'👑 مدیر سفر':'👤 عضو سفر'}</p></div><button class="btn danger" onclick="logoutUser()">خروج از حساب</button></div>`;m.classList.remove('hidden');};


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
 const b=e.target.closest('[data-page]');if(b){e.preventDefault();showPage(b.dataset.page);return;}
 if(e.target===modal())closeModal();
});renderPending();setTimeout(loadExpenses,500);setTimeout(loadHomeAlbum,800);
