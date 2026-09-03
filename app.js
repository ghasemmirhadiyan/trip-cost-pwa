const APP_VERSION = "14.5"
const state={role:'admin',user:'قاسم',trip:'سفر شمال ۱۴۰۵',pendingMembers:[],members:[],expenses:[],locations:[],itinerary:[],shareAmount:12000000,settlementEnabled:false};
const $=s=>document.querySelector(s); let modal=()=>document.querySelector('#modal');

// Global in-app alert: replace browser alerts with a consistent message sheet.
// Authenticated users get a Home button; unauthenticated users get a Back button.
const nativeBrowserAlert = window.alert.bind(window);
window.alert = function(message){
  const m=document.querySelector('#modal');
  if(!m){ nativeBrowserAlert(message); return; }
  const loggedIn=!!window.authState?.session;
  const safe=escapeHtml(String(message??''));
  m.innerHTML=`<div class="sheet app-message-sheet">
    <div class="message-icon">ℹ️</div>
    <h2>پیام برنامه</h2>
    <div class="app-message-text">${safe.replace(/\n/g,'<br>')}</div>
    <div class="message-actions">
      ${loggedIn?'<button class="btn" onclick="closeModal();showPage(\'home\')">🏠 بازگشت به خانه</button>':'<button class="btn" onclick="closeModal();window.showAuth?.()">↩️ بازگشت</button>'}
      <button class="btn secondary" onclick="closeModal()">بستن</button>
    </div>
  </div>`;
  m.classList.remove('hidden');
};

const money=n=>new Intl.NumberFormat('fa-IR').format(Number(n)||0)+' تومان';
const statusFa=s=>({pending:'در انتظار',approved:'تأیید شده',rejected:'رد شده'}[s]||s||'در انتظار');
async function loadTripSettings(){
 if(!window.authState?.tripId)return null;
 const {data,error}=await window.sb.from('trips').select('id,share_amount,settlement_enabled').eq('id',window.authState.tripId).maybeSingle();
 if(error) throw error;
 state.shareAmount=Number(data?.share_amount||12000000);
 state.settlementEnabled=Boolean(data?.settlement_enabled);
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
async function loadItinerary(){
 if(!window.authState?.tripId)return [];
 const {data,error}=await window.sb.from('itinerary_items').select('id,trip_id,item_date,start_time,end_time,title,description,location_id,sort_order,created_by,created_at,status,submitted_by,rejection_reason,locations(name)').eq('trip_id',window.authState.tripId).order('item_date',{ascending:true}).order('sort_order',{ascending:true}).order('start_time',{ascending:true,nullsFirst:true});
 if(error)throw error; state.itinerary=(data||[]).map(x=>({...x,location:Array.isArray(x.locations)?x.locations[0]:x.locations})); return state.itinerary;
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
 if(page==='expenses'||page==='pending'||page==='approved'||page==='rejected'){title=page==='pending'?'🟡 هزینه‌های در انتظار تأیید':page==='approved'?'🟢 هزینه‌های تأیید شده':page==='rejected'?'🔴 هزینه‌های رد شده':'💰 هزینه‌ها'; const arr=page==='pending'?state.expenses.filter(e=>e.status==='pending'):page==='approved'?state.expenses.filter(e=>e.status==='approved'):page==='rejected'?state.expenses.filter(e=>e.status==='rejected'):state.expenses; body=`<div class="filter-row"><button class="chip ${page==='expenses'?'active':''}" onclick="showPage('expenses')">همه</button><button class="chip ${page==='pending'?'active':''}" onclick="showPage('pending')">🟡 در انتظار</button><button class="chip ${page==='approved'?'active':''}" onclick="showPage('approved')">🟢 تأیید شده</button><button class="chip ${page==='rejected'?'active':''}" onclick="showPage('rejected')">🔴 رد شده</button></div>${arr.map(e=>{const payer=state.members.find(m=>m.id===e.payer_member_id);return `<div class="list-item"><span class="badge ${e.status==='pending'?'pending':e.status==='approved'?'approved':'danger'}">${statusFa(e.status)}</span><b>${escapeHtml(e.title)}</b><p>${e.from_fund?'🏦 صندوق':escapeHtml(payer?.name||'پرداخت‌کننده')} • ${money(e.amount)}</p><small>تاریخ: ${e.expense_date||''}</small>${window.authState?.member?.role==='admin'?`<div class="actions"><button class="btn small" onclick="editExpense('${e.id}')">✏️ ویرایش</button>${e.status==='pending'?`<button class="btn small" onclick="approveExpense('${e.id}')">✓ تأیید</button><button class="btn danger small" onclick="rejectExpense('${e.id}')">× رد</button>`:''}</div>`:''}</div>`}).join('')||'<div class="empty-state">موردی برای نمایش وجود ندارد.</div>'}<button class="btn" onclick="newExpense()">➕ ثبت هزینه جدید</button>`; setTimeout(loadTripMembers,0); setTimeout(loadExpenses,0);
 } else if(page==='fund'){title='🏦 صندوق';body=`<div id="fundLive"><div class="stat primary"><span>موجودی فعلی صندوق</span><strong>در حال محاسبه...</strong><small>تومان</small></div><div class="stat" style="margin-top:10px"><span>📥 مطالبات صندوق</span><strong>در حال محاسبه...</strong><small>تومان</small></div></div><button class="btn" onclick="newContribution()">➕ ثبت واریزی به صندوق</button><div id="contributionList"><div class="list-item"><b>تراکنش‌های صندوق</b><p class="muted">در حال بارگذاری...</p></div></div>`;setTimeout(async()=>{const f=await loadFinancialSummary();const t=f?.trip||{};const memberRows=f?.members||[];const totalWeight=memberRows.reduce((sum,m)=>sum+Number(m.share_weight||0),0);const totalExpected=totalWeight*Number(t.share_amount||state.shareAmount||0);const totalPaid=memberRows.reduce((sum,m)=>sum+Number(m.approved_contributions||0),0);const totalClaim=Math.max(totalExpected-totalPaid,0);const totalOver=Math.max(totalPaid-totalExpected,0);const el=document.querySelector('#fundLive');if(el)el.innerHTML=`<div class="fund-overview"><div class="stat primary"><span>🎯 کل مبلغ مورد انتظار صندوق</span><strong>${money(totalExpected)}</strong><small>${Number(t.share_amount||state.shareAmount||0).toLocaleString('fa-IR')} تومان برای هر سهم × ${totalWeight.toLocaleString('fa-IR')} مجموع ضریب اعضا</small></div><div class="fund-grid"><div class="stat"><span>💵 پرداخت تأییدشده</span><strong>${money(totalPaid)}</strong></div><div class="stat"><span>📥 مانده قابل وصول</span><strong>${money(totalClaim)}</strong></div><div class="stat"><span>🏦 موجودی فعلی صندوق</span><strong>${money(t.current_fund_balance)}</strong></div><div class="stat"><span>💳 طلب مازاد</span><strong>${money(totalOver)}</strong></div></div><div class="formula-box"><b>فرمول محاسبه</b><p>مبلغ هر سهم × مجموع ضرایب اعضا = کل مبلغ مورد انتظار صندوق</p><p>${money(Number(t.share_amount||state.shareAmount||0))} × ${totalWeight.toLocaleString('fa-IR')} = <b>${money(totalExpected)}</b></p></div></div>`;const rows=await loadContributions();const lm=document.querySelector('#contributionList');if(lm)lm.innerHTML=`<div class="section-head"><h3>📋 وضعیت پرداخت اعضا</h3></div>${(f?.members||[]).map(m=>{const target=Number(m.contribution_target||0),paid=Number(m.approved_contributions||0),diff=paid-target;const label=diff<0?'بدهکار':diff>0?'طلبکار':'تسویه';return `<div class="list-item"><b>${escapeHtml(m.name)}</b><span class="badge ${diff<0?'pending':diff>0?'approved':'approved'}">${label}</span><p>تعهد: ${money(target)} • پرداخت تأییدشده: ${money(paid)}</p><small>${diff<0?`بدهی به صندوق: ${money(-diff)}`:diff>0?`طلب از صندوق: ${money(diff)}`:'حساب صندوق تسویه است'}</small></div>`}).join('')}<div class="section-head"><h3>📥 تراکنش‌های صندوق</h3></div>`+rows.map(c=>{const m=state.members.find(x=>Number(x.id)===Number(c.trip_member_id));const cls=c.status==='approved'?'approved':c.status==='rejected'?'danger':'pending';const label=statusFa(c.status);const actions=window.authState?.member?.role==='admin'&&c.status==='pending'?`<div class="actions"><button class="btn small" onclick="approveContribution('${c.id}')">✓ تأیید</button><button class="btn danger small" onclick="rejectContribution('${c.id}')">× رد</button></div>`:'';return `<div class="list-item"><span class="badge ${cls}">${label}</span><b>📥 ${escapeHtml(m?.name||'عضو')}</b><p>${money(c.amount)} تومان • ${c.method==='cash'?'نقدی':c.method==='card'?'کارت':c.method==='bank_transfer'?'انتقال بانکی':'سایر'}</p><small>تاریخ: ${c.contribution_date||''}</small>${c.note?`<p>${escapeHtml(c.note)}</p>`:''}${actions}</div>`}).join('')||'<div class="empty-state">هنوز واریزی ثبت نشده است.</div>';},0);
 } else if(page==='members'){await loadTripSettings();await loadTripMembers();const fin=await loadFinancialSummary();const fm=Object.fromEntries((fin?.members||[]).map(x=>[String(x.trip_member_id),x]));const pendingReqs=window.authState?.member?.role==='admin'?await loadMembershipRequests():[];title='👥 اعضای سفر';body=`<div class="stat primary"><span>💰 مبلغ هر سهم</span><strong>${money(state.shareAmount)}</strong><small>تعهد صندوق هر عضو بر اساس ضریب ثابت سفر محاسبه می‌شود</small></div>${window.authState?.member?.role==='admin'?`<button class="btn" onclick="editShareAmount()">✏️ تغییر مبلغ هر سهم</button><button class="btn ${state.settlementEnabled?'secondary':'success'}" onclick="toggleFinalSettlement()">${state.settlementEnabled?'🔒 غیرفعال کردن تسویه نهایی':'🔓 فعال کردن تسویه نهایی'}</button><button class="btn secondary" onclick="copyInvite()">🔗 ساخت و کپی لینک دعوت</button><div class="list-item"><b>📨 درخواست‌های عضویت</b><p class="muted">هر کسی با لینک دعوت حساب بسازد، تا تأیید مدیر عضو فعال نمی‌شود.</p>${pendingReqs.length?pendingReqs.map(r=>`<div class="membership-request"><b>${escapeHtml(r.full_name)}</b><small>${escapeHtml(r.phone||'شماره ثبت نشده')} • ${new Date(r.requested_at).toLocaleString('fa-IR')}</small>${r.note?`<p>${escapeHtml(r.note)}</p>`:''}<div class="actions"><button class="btn small" onclick="approveMember('${r.id}')">✓ تأیید</button><button class="btn danger small" onclick="rejectMember('${r.id}')">× رد</button></div></div>`).join(''):'<p class="muted">درخواست جدیدی وجود ندارد.</p>'}</div>`:''}<button type="button" class="btn" data-action="add-member">➕ ساخت حساب و افزودن عضو</button><p class="muted">بدهی یا طلب صندوق بر اساس واریزی‌های تأییدشده محاسبه می‌شود.</p>${state.members.map(m=>{const f=fm[String(m.id)]||{};const target=Number(m.contribution_target||f.contribution_target||0);const paid=Number(f.approved_contributions||0);const diff=paid-target;const balanceHtml=diff<0?`<span class="fund-debt">🔴 بدهی به صندوق: ${money(-diff)}</span>`:diff>0?`<span class="fund-credit">🟢 طلب از صندوق: ${money(diff)}</span>`:`<span class="fund-settled">⚪ تسویه شده</span>`;return `<div class="list-item member-item"><div class="member-head"><div class="mini-avatar">${m.avatar_url?`<img src="${escapeAttr(m.avatar_url)}" alt="">`:(escapeHtml((m.name||'ع').slice(0,1)))}</div><b>${escapeHtml(m.name)}</b></div><div class="member-finance"><div><small>تعهد صندوق</small><strong>${money(target)}</strong></div><div>${balanceHtml}</div></div><small>${m.role==='admin'?'👑 مدیر سفر':'👤 عضو'}</small>${window.authState?.member?.role==='admin'?`<div class="actions"><button class="btn small" onclick="editMember('${m.id}')">✏️ ویرایش پروفایل</button>${m.user_id!==window.authState?.session?.user?.id?`<button class="btn danger small" onclick="deleteMember('${m.id}','${escapeAttr(m.name)}')">🗑️ حذف</button>`:''}</div>`:''}</div>`}).join('')||'<p class="muted">عضوی وجود ندارد.</p>'}`;
 } else if(page==='locations'){await loadLocations();title='📍 مکان‌های دیدنی';body=`<button class="btn" data-action="add-location">➕ پیشنهاد مکان جدید</button><p class="muted">هر عضو می‌تواند مکان پیشنهاد کند؛ مکان پیشنهادی پس از تأیید مدیر برای همه قابل استفاده است.</p>${state.locations.map(l=>{const st=l.status||'pending';const cls=st==='approved'?'approved':st==='rejected'?'danger':'pending';const actions=window.authState?.member?.role==='admin'&&st==='pending'?`<div class="actions"><button class="btn small" onclick="approveLocation('${l.id}')">✓ تأیید</button><button class="btn danger small" onclick="rejectLocation('${l.id}')">× رد</button></div>`:'';return `<div class="list-item"><span class="badge ${cls}">${statusFa(st)}</span><b>📍 ${escapeHtml(l.name)}</b>${l.category?`<p>دسته‌بندی: ${escapeHtml(l.category)}</p>`:''}${l.description?`<p>${escapeHtml(l.description)}</p>`:''}${l.suggested_duration_minutes?`<small>⏱️ حدود ${l.suggested_duration_minutes} دقیقه</small>`:''}${l.map_url?`<p><a href="${escapeAttr(l.map_url)}" target="_blank" rel="noopener">🗺️ مشاهده روی نقشه</a></p>`:''}${actions}</div>`}).join('')||'<div class="empty-state">هنوز مکانی پیشنهاد نشده است.</div>'}`;
 } else if(page==='itinerary'){await loadItinerary();title='🗺️ برنامه سفر';body=`<button class="btn" onclick="addItineraryProposal()">➕ پیشنهاد برنامه جدید</button><p class="muted">همه اعضای سفر می‌توانند برنامه پیشنهاد دهند؛ برنامه پس از تأیید مدیر برای همه قطعی می‌شود.</p>${state.itinerary.map(x=>{const st=x.status||'pending';const cls=st==='approved'?'approved':st==='rejected'?'danger':'pending';const actions=window.authState?.member?.role==='admin'&&st==='pending'?`<div class="actions"><button class="btn small" onclick="approveItinerary('${x.id}')">✓ تأیید</button><button class="btn danger small" onclick="rejectItinerary('${x.id}')">× رد</button></div>`:'';const tm=[x.start_time,x.end_time].filter(Boolean).join(' تا ');return `<div class="list-item"><span class="badge ${cls}">${statusFa(st)}</span><b>${escapeHtml(x.title)}</b><p>📅 ${escapeHtml(x.item_date||'')}${tm?' • ⏰ '+escapeHtml(tm):''}</p>${x.description?`<p>${escapeHtml(x.description)}</p>`:''}${x.location?.name?`<small>📍 ${escapeHtml(x.location.name)}</small>`:''}${actions}</div>`}).join('')||'<div class="empty-state">هنوز برنامه‌ای ثبت نشده است.</div>'}`;
 } else if(page==='checklist'){title='🎒 چک‌لیست سفر';body=`<div class="checklist-intro"><b>چک‌لیست مشترک سفر</b><p class="muted">همه اعضای فعال می‌توانند وسیله‌ای اضافه کنند یا وضعیت آن را علامت بزنند. نام ثبت‌کننده کنار هر مورد نمایش داده می‌شود.</p></div><div class="checklist-add"><input id="checkItemInput" placeholder="مثلاً قهوه‌ساز مسافرتی" maxlength="200"><button class="btn" onclick="addChecklistItem()">➕ افزودن</button></div><div id="checklistList"><div class="empty-state">در حال بارگذاری...</div></div>`;setTimeout(loadChecklist,0);
 } else if(page==='notifications'){title='🔔 اعلان‌ها';body=`<div class="list-item"><b>مرکز اعلان‌ها</b><p class="muted">درخواست‌های جدید سفر در این بخش نمایش داده می‌شوند.</p></div><div id="notificationsList"><div class="empty-state">در حال بررسی درخواست‌ها...</div></div>`;setTimeout(loadNotificationsPage,0);
 } else if(page==='settlement'){await loadTripSettings(); title='💸 تسویه نهایی سفر'; if(!state.settlementEnabled){body=`<div class="settlement-locked"><div class="settlement-lock-icon">🔒</div><h2>تسویه نهایی هنوز فعال نشده است</h2><p>این بخش فقط در پایان سفر و با فعال‌سازی مدیر قابل استفاده است.</p><strong>بدستور مدیر سفر، تسویه اعضا فعلاً غیرفعال است.</strong><small>لطفاً پس از اعلام مدیر دوباره به این بخش مراجعه کنید.</small><button class="btn" onclick="showPage('home')">🏠 بازگشت به صفحه اصلی</button></div>`;}else{body=`<div class="settlement-intro"><b>این بخش برای پایان سفر است</b><p>در پایان سفر، مانده صندوق و تسویه بین اعضا در اینجا محاسبه می‌شود.</p></div><div id="finalSettlement"><div class="empty-state">در حال محاسبه تسویه نهایی...</div></div>`;setTimeout(renderFinalSettlement,0);}
 } else if(page==='album'){title='📷 آلبوم سفر';body=`<div class="album-toolbar"><p class="muted">اعضای فعال سفر می‌توانند عکس اضافه کنند، لایک کنند و نظر بگذارند.</p><button class="btn" onclick="uploadPhoto()">📤 آپلود عکس</button></div><div id="albumGrid" class="album-grid"><div class="empty-state">در حال بارگذاری آلبوم...</div></div>`; setTimeout(loadAlbum,0);
 } else if(page==='about'){title='ℹ️ درباره برنامه';body=`<div class="about-card"><div class="about-logo">🌲</div><div class="about-kicker">سفر شمال ۱۴۰۵</div><h3>همه‌چیز برای یک سفر خانوادگی بهتر</h3><p>این برنامه برای مدیریت ساده و شفاف هزینه‌ها، صندوق سفر، اعضا، مکان‌های پیشنهادی، برنامه سفر و خاطرات تصویری طراحی شده است تا همه اعضای خانواده اطلاعات سفر را یکجا ببینند و هماهنگ باشند.</p><div class="about-features"><span>💰 مدیریت هزینه</span><span>🏦 صندوق مشترک</span><span>🗺️ برنامه سفر</span><span>📷 آلبوم خاطرات</span></div><div class="creator-card"><div class="creator-avatar">ق</div><div><small>سازنده و مدیر برنامه</small><strong>قاسم میرهادیان</strong><p>طراحی و توسعه با هدف ساده‌تر شدن مدیریت سفرهای خانوادگی</p></div></div><div class="about-footer">با آرزوی سفری شاد، آرام و پر از خاطرات خوب ❤️</div></div>`;
 } else if(page==='profile'){title='👤 پروفایل';const u=window.authState?.profile, m=window.authState?.member;body=`<div class="profile-card"><div class="profile-avatar">${u?.avatar_url?`<img src="${escapeAttr(u.avatar_url)}" alt="پروفایل">`:(escapeHtml((u?.display_name||state.user||'ق').slice(0,1)))}</div><button class="btn small" onclick="uploadProfilePhoto()">📷 ${u?.avatar_url?'تغییر عکس پروفایل':'افزودن عکس پروفایل'}</button><h3>${u?.display_name||state.user||'کاربر'}</h3><p>${u?.phone||'شماره موبایل ثبت نشده'}</p><p>${window.authState?.session?.user?.email||'ایمیل ثبت نشده'}</p><span class="badge ${m?.role==='admin'?'approved':'pending'}">${m?.role==='admin'?'👑 مدیر سفر':'👤 عضو سفر'}</span></div><div class="list-item"><b>🧳 سفر فعال</b><p>${window.authState?.trip?.title||state.trip}</p></div>${m?.role==='admin'?'<button class="btn" onclick="showPage(\'admin\')">👑 پنل مدیریت</button>':''}${window.authState?.session?'<button class="btn danger" onclick="logoutUser()">خروج از حساب</button>':'<button class="btn" onclick="showAuth()">ورود / ایجاد حساب</button>'}`;
} else if(page==='admin'){title='👑 پنل مدیریت';body=`<div class="admin-grid"><button onclick="showPage('members')">👥<b>اعضا</b><small>مدیریت اعضا</small></button><button onclick="showPage('pending')">🟡<b>تأیید هزینه‌ها</b><small>بررسی هزینه‌های جدید</small></button><button>📊<b>گزارش‌ها</b><small>Excel / PDF</small></button></div>`;
 } else {title='☰ امکانات بیشتر';body=`<div class="list-item install-menu-item" onclick="installPWA()"><b>📲 نصب برنامه روی اندروید</b><p>نصب مستقیم روی صفحه اصلی موبایل</p></div>`+[['📷 آلبوم عکس','album'],['🎒 چک‌لیست سفر','checklist'],['🔔 اعلان‌ها','notifications'],['📊 گزارش‌ها و نمودارها','reports'],['⚙️ تنظیمات','settings']].map(([x,p])=>`<div class="list-item" onclick="showPage('${p}')"><b>${x}</b></div>`).join('')+`<div class="list-item about-menu-item" onclick="showPage('about')"><b>ℹ️ درباره برنامه</b><p>معرفی برنامه و سازنده</p></div>`+(state.role==='admin'?`<div class="list-item" onclick="showPage('admin')"><b>👑 پنل مدیریت</b><p>مدیریت اعضا، تأییدها و سفرها</p></div>`:'');}
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
 modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>✓ تأیید عضویت</h2><div class="form"><label>نام عضو<input id="mn" value="${escapeHtml(m.full_name||'')}"></label><label>ضریب مشارکت<input id="mw" type="number" step="0.5" min="0.5" value="1" oninput="updateMembershipTargetPreview()"></label><p class="muted">تعهد صندوق این عضو: <b id="membershipTargetPreview">${money(state.shareAmount)}</b></p><button class="btn" onclick="activateMember('${m.id}')">✓ تأیید و فعال‌سازی</button></div></div>`;modal().classList.remove('hidden');
};
window.updateMembershipTargetPreview=()=>{const w=Number($('#mw')?.value||1),amount=Number(state.shareAmount||12000000);const el=$('#membershipTargetPreview');if(el)el.textContent=money(Math.round(w*amount));};
window.activateMember=async(requestId)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند اعضا را تأیید کند.');
 const n=$('#mn')?.value.trim(),w=Number($('#mw')?.value||1),c=Math.round(w*Number(state.shareAmount||12000000));
 if(!n||w<0.5)return alert('نام و ضریب معتبر را وارد کنید.');
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
 const btn=document.querySelector('[onclick*=\"saveMemberProfile(\']')||document.querySelector('.sheet .btn');
 if(btn)btn.disabled=true;
 try{
  const {error}=await window.sb.rpc('update_trip_member_profile',{p_member_id:Number(id),p_name:name,p_phone:phone,p_share_weight:weight,p_role:role});
  if(error){console.error('update_trip_member_profile',error);alert('ویرایش پروفایل انجام نشد:\n'+(error.message||error.details||'خطای نامشخص')+'\n\nاگر این خطا را می‌بینی، SQL نسخه 12.7 را در Supabase اجرا کن.');return;}
  alert('پروفایل عضو با موفقیت به‌روزرسانی شد.'); closeModal(); await loadTripMembers(); await showPage('members');
 }finally{if(btn)btn.disabled=false;}
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

window.addItineraryProposal=async()=>{
 if(!window.authState?.session){showAuth();return;}
 if(!window.authState?.tripId)return alert('ابتدا عضو سفر شوید.');
 await loadLocations(); const approved=state.locations.filter(x=>x.status==='approved');
 const opts=approved.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
 modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>🗺️ پیشنهاد برنامه</h2><p class="muted">پیشنهاد شما بعد از تأیید مدیر در برنامه نهایی نمایش داده می‌شود.</p><div class="form"><label>تاریخ<input id="idate" type="date" required></label><label>ساعت شروع<input id="istart" type="time"></label><label>ساعت پایان<input id="iend" type="time"></label><label>عنوان برنامه<input id="ititle" placeholder="مثلاً بازدید از جواهرده" required></label><label>توضیحات<textarea id="idesc" placeholder="توضیحات اختیاری"></textarea></label><label>مکان پیشنهادی<select id="iloc"><option value="">بدون انتخاب</option>${opts}</select></label><button class="btn" onclick="saveItineraryProposal()">ارسال برای تأیید مدیر</button></div></div>`;modal().classList.remove('hidden');
};
window.saveItineraryProposal=async()=>{
 const uid=window.authState?.session?.user?.id;if(!uid||!window.authState?.tripId)return showAuth();
 const item_date=$('#idate')?.value,start_time=$('#istart')?.value||null,end_time=$('#iend')?.value||null,title=$('#ititle')?.value.trim(),description=$('#idesc')?.value.trim()||null,location_id=$('#iloc')?.value||null;
 if(!item_date||!title)return alert('تاریخ و عنوان برنامه الزامی است.');
 const {error}=await window.sb.from('itinerary_items').insert({trip_id:window.authState.tripId,item_date,start_time,end_time,title,description,location_id,sort_order:0,created_by:uid,submitted_by:uid,status:'pending'});
 if(error){alert('ثبت پیشنهاد برنامه انجام نشد: '+error.message);return;}closeModal();alert('برنامه برای تأیید مدیر ارسال شد.');await showPage('itinerary');
};
window.approveItinerary=async(id)=>{if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند برنامه را تأیید کند.');const {error}=await window.sb.from('itinerary_items').update({status:'approved',approved_by:window.authState.session.user.id,approved_at:new Date().toISOString(),rejection_reason:null}).eq('id',id).eq('trip_id',window.authState.tripId);if(error){alert('تأیید برنامه انجام نشد: '+error.message);return;}await showPage('itinerary');};
window.rejectItinerary=async(id)=>{if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند برنامه را رد کند.');const reason=prompt('دلیل رد برنامه (اختیاری):')||null;const {error}=await window.sb.from('itinerary_items').update({status:'rejected',approved_by:window.authState.session.user.id,approved_at:new Date().toISOString(),rejection_reason:reason}).eq('id',id).eq('trip_id',window.authState.tripId);if(error){alert('رد برنامه انجام نشد: '+error.message);return;}await showPage('itinerary');};

window.newExpense=async()=>{
 if(!window.authState?.session){showAuth();return;}
 if(!window.authState?.tripId){alert('ابتدا عضو یک سفر شوید.');return;}
 try{await loadTripMembers();}catch(e){alert('اعضای سفر بارگذاری نشد: '+e.message);return;}
 const opts=state.members.map(m=>`<label class="check-row"><input type="checkbox" name="ep" value="${m.id}" checked><span>${escapeHtml(m.name)}</span></label>`).join('');
 const payers=state.members.map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
 modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>➕ ثبت هزینه جدید</h2><p class="muted">هزینه ابتدا برای تأیید مدیر ارسال می‌شود و تا قبل از تأیید در محاسبات مالی وارد نمی‌شود.</p><div class="form"><label>عنوان هزینه<input id="exTitle" placeholder="مثلاً خرید مواد غذایی"></label><label>مبلغ (تومان)<input id="exAmount" type="number" min="1" inputmode="numeric"></label><label>تاریخ<input id="exDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>دسته‌بندی<select id="exCat"><option value="food">غذا</option><option value="accommodation">اقامت</option><option value="transport">حمل‌ونقل</option><option value="fuel">سوخت</option><option value="shopping">خرید</option><option value="entertainment">تفریح</option><option value="sightseeing">گردش</option><option value="medical">پزشکی</option><option value="other">سایر</option></select></label><label>نحوه پرداخت<select id="exFromFund" onchange="togglePayerField()"><option value="true">از صندوق مشترک</option><option value="false">پرداخت شخصی</option></select></label><label id="payerWrap" class="hidden">پرداخت‌کننده<select id="exPayer">${payers}</select></label><label>توضیحات<textarea id="exNote" placeholder="توضیح اختیاری"></textarea></label><div><b>اعضای مشمول هزینه</b><p class="muted">همه اعضای فعال به‌صورت پیش‌فرض انتخاب شده‌اند؛ در صورت نیاز فقط انتخاب/حذف کنید.</p>${opts}</div><button class="btn" onclick="saveExpense()">ارسال برای تأیید مدیر</button></div></div>`;modal().classList.remove('hidden');};
window.togglePayerField=()=>{const w=document.querySelector('#payerWrap');const f=document.querySelector('#exFromFund');w?.classList.toggle('hidden',f?.value==='true');};
window.editExpense=async(id)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند هزینه را ویرایش کند.');
 try{
  const [{data:e,error:ee},{data:parts,error:pe}]=await Promise.all([window.sb.from('expenses').select('id,trip_id,expense_date,title,category,amount,from_fund,payer_member_id,status,note').eq('id',id).eq('trip_id',window.authState.tripId).maybeSingle(),window.sb.from('expense_participants').select('trip_member_id').eq('expense_id',id)]);
  if(ee)throw ee; if(pe)throw pe; if(!e)throw new Error('هزینه پیدا نشد.');
  await loadTripMembers();
  const selected=new Set((parts||[]).map(x=>String(x.trip_member_id)));
  const opts=state.members.map(m=>`<label class="check-row"><input type="checkbox" name="eep" value="${m.id}" ${selected.has(String(m.id))?'checked':''}><span>${escapeHtml(m.name)}</span></label>`).join('');
  const payers=state.members.map(m=>`<option value="${m.id}" ${Number(e.payer_member_id)===Number(m.id)?'selected':''}>${escapeHtml(m.name)}</option>`).join('');
  modal().innerHTML=`<div class="sheet"><button class="close" onclick="closeModal()">×</button><h2>✏️ ویرایش هزینه</h2><p class="muted">مدیر می‌تواند تمام جزئیات هزینه، پرداخت‌کننده و اعضای مشمول را اصلاح کند. وضعیت فعلی هزینه حفظ می‌شود.</p><div class="form"><label>عنوان هزینه<input id="exTitle" value="${escapeAttr(e.title||'')}"></label><label>مبلغ (تومان)<input id="exAmount" type="number" min="1" inputmode="numeric" value="${Number(e.amount||0)}"></label><label>تاریخ<input id="exDate" type="date" value="${e.expense_date||''}"></label><label>دسته‌بندی<select id="exCat"><option value="food">غذا</option><option value="accommodation">اقامت</option><option value="transport">حمل‌ونقل</option><option value="fuel">سوخت</option><option value="shopping">خرید</option><option value="entertainment">تفریح</option><option value="sightseeing">گردش</option><option value="medical">پزشکی</option><option value="other">سایر</option></select></label><label>نحوه پرداخت<select id="exFromFund"><option value="true">از صندوق مشترک</option><option value="false">پرداخت شخصی</option></select></label><label id="payerWrap">پرداخت‌کننده<select id="exPayer">${payers}</select></label><label>توضیحات<textarea id="exNote">${escapeHtml(e.note||'')}</textarea></label><div><b>اعضای مشمول هزینه</b><p class="muted">اعضای انتخاب‌شده مبنای محاسبه سهم این هزینه هستند.</p>${opts}</div><button class="btn" id="saveEditedExpenseBtn" type="button">💾 ذخیره تغییرات</button></div></div>`;
  const cat=document.querySelector('#exCat');if(cat)cat.value=e.category||'other';
  const ff=document.querySelector('#exFromFund');if(ff){ff.value=e.from_fund?'true':'false';ff.onchange=togglePayerField;}
  const btn=document.querySelector('#saveEditedExpenseBtn');if(btn)btn.onclick=()=>saveEditedExpense(id);
  togglePayerField();modal().classList.remove('hidden');
 }catch(err){console.error('editExpense',err);alert('اطلاعات هزینه برای ویرایش بارگذاری نشد:\n'+(err?.message||err));}
};
window.saveEditedExpense=async(id)=>{
 if(window.authState?.member?.role!=='admin')return alert('فقط مدیر سفر می‌تواند هزینه را ویرایش کند.');
 const title=$('#exTitle')?.value.trim(),amount=Number($('#exAmount')?.value),date=$('#exDate')?.value,category=$('#exCat')?.value||'other',fromFund=$('#exFromFund')?.value==='true',payer=Number($('#exPayer')?.value||0)||null,note=$('#exNote')?.value.trim()||null,participants=[...document.querySelectorAll('input[name=eep]:checked')].map(x=>Number(x.value));
 if(!title||!Number.isFinite(amount)||amount<=0)return alert('عنوان و مبلغ را کامل و صحیح وارد کنید.');
 if(!date)return alert('تاریخ هزینه را وارد کنید.');
 if(!participants.length)return alert('حداقل یک عضو باید در هزینه سهیم باشد.');
 if(!fromFund&&!payer)return alert('پرداخت‌کننده را انتخاب کنید.');
 if(new Set(participants).size!==participants.length)return alert('اعضای مشمول تکراری هستند.');
 if(!confirm('تغییرات این هزینه ذخیره شود؟'))return;
 const btn=document.querySelector('#saveEditedExpenseBtn');if(btn){btn.disabled=true;btn.textContent='در حال ذخیره...';}
 try{const {error}=await window.sb.rpc('update_expense_admin',{p_expense_id:id,p_expense_date:date,p_title:title,p_category:category,p_amount:Math.round(amount),p_from_fund:fromFund,p_payer_member_id:fromFund?null:payer,p_note:note,p_participants:participants});if(error)throw error;closeModal();await loadExpenses();await showPage('expenses');alert('هزینه با موفقیت ویرایش شد.');}
 catch(err){console.error('saveEditedExpense',err);if(btn){btn.disabled=false;btn.textContent='💾 ذخیره تغییرات';}alert('ویرایش هزینه انجام نشد:\n'+(err?.message||err));}
};
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
 const uploaderIds=[...new Set(list.map(p=>p.uploaded_by).filter(Boolean))];
 const [lr,cr]=await Promise.all([
  window.sb.from('photo_likes').select('id,photo_id,user_id').in('photo_id',ids),
  window.sb.from('photo_comments').select('id,photo_id,user_id,comment,created_at').in('photo_id',ids).order('created_at',{ascending:true})
 ]);
 if(lr.error)throw lr.error;if(cr.error)throw cr.error;
 const allUserIds=[...new Set([...list.map(p=>p.uploaded_by),...(cr.data||[]).map(c=>c.user_id)].filter(Boolean))];
 const pr=allUserIds.length?await window.sb.from('profiles').select('user_id,display_name,avatar_url').in('user_id',allUserIds):{data:[],error:null};
 if(pr.error)throw pr.error;
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
  return `<article class="photo-card ${compact?'compact':''}"><img src="${escapeAttr(photoUrl(ph))}" loading="lazy" alt="عکس سفر" onclick="openPhoto('${ph.id}')"><div class="photo-meta"><b>${escapeHtml(profileMap[ph.uploaded_by]||'عضو سفر')}</b><div class="photo-actions"><button class="icon-btn ${liked?'liked':''}" onclick="togglePhotoLike('${ph.id}')">♥ ${phLikes.length}</button><button class="icon-btn" onclick="addPhotoComment('${ph.id}')">💬 ${allComments.length}</button></div></div>${ph.caption?`<p>${escapeHtml(ph.caption)}</p>`:''}<div class="comments">${phComments.map(c=>{const cp=(profileRows||[]).find(x=>x.user_id===c.user_id);return `<div class="comment-row"><div class="comment-avatar">${cp?.avatar_url?`<img src="${escapeAttr(cp.avatar_url)}" alt="">`:escapeHtml((cp?.display_name||'ع').slice(0,1))}</div><div><b>${escapeHtml(cp?.display_name||'عضو سفر')}</b><small>${new Date(c.created_at).toLocaleString('fa-IR')}</small><p>${escapeHtml(c.comment)}</p></div></div>`}).join('')}</div></article>`;
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
async function loadChecklist(){
 const el=document.querySelector('#checklistList'); if(!el||!window.authState?.tripId)return;
 const {data,error}=await window.sb.from('trip_checklist_items').select('id,item,added_by,is_done,completed_by,completed_at,created_at').eq('trip_id',window.authState.tripId).order('created_at',{ascending:false});
 if(error){el.innerHTML=`<div class="empty-state">چک‌لیست هنوز آماده نیست.<br><small>${escapeHtml(error.message)}</small></div>`;return;}
 const ids=[...new Set((data||[]).map(x=>x.added_by).filter(Boolean).concat((data||[]).map(x=>x.completed_by).filter(Boolean)))];
 let names={};
 if(ids.length){const {data:ms}=await window.sb.from('trip_members').select('user_id,name').eq('trip_id',window.authState.tripId).in('user_id',ids); names=Object.fromEntries((ms||[]).map(x=>[x.user_id,x.name]));}
 el.innerHTML=(data||[]).map(x=>`<div class="list-item checklist-item ${x.is_done?'done':''}"><div class="check-row"><label><input type="checkbox" ${x.is_done?'checked':''} onchange="toggleChecklistItem('${x.id}',this.checked)"><span class="checkmark">${x.is_done?'✓':'○'}</span></label><div class="check-content"><b>${escapeHtml(x.item)}</b><small>➕ ثبت توسط <strong>${escapeHtml(names[x.added_by]||'عضو سفر')}</strong> • ${new Date(x.created_at).toLocaleString('fa-IR')}</small>${x.is_done?`<small class="done-by">✅ انجام شد توسط <strong>${escapeHtml(names[x.completed_by]||'عضو سفر')}</strong></small>`:''}</div><button class="icon-btn" onclick="deleteChecklistItem('${x.id}')">🗑️</button></div></div>`).join('')||'<div class="empty-state">هنوز چیزی به چک‌لیست اضافه نشده است.</div>';
}
window.addChecklistItem=async()=>{
 const input=document.querySelector('#checkItemInput'); const item=input?.value.trim();
 if(!item)return alert('لطفاً نام وسیله یا مورد موردنظر را وارد کنید.');
 const {error}=await window.sb.from('trip_checklist_items').insert({trip_id:window.authState.tripId,item,added_by:window.authState.session.user.id});
 if(error){alert('افزودن به چک‌لیست انجام نشد:\n'+error.message);return;}
 input.value=''; await loadChecklist();
};
window.toggleChecklistItem=async(id,done)=>{
 const patch={is_done:!!done,completed_by:done?window.authState.session.user.id:null,completed_at:done?new Date().toISOString():null};
 const {error}=await window.sb.from('trip_checklist_items').update(patch).eq('id',id);
 if(error){alert('تغییر وضعیت انجام نشد:\n'+error.message);await loadChecklist();return;} await loadChecklist();
};
window.deleteChecklistItem=async(id)=>{if(!confirm('این مورد از چک‌لیست حذف شود؟'))return;const {error}=await window.sb.from('trip_checklist_items').delete().eq('id',id);if(error){alert('حذف انجام نشد:\n'+error.message);return;}await loadChecklist();};
async function loadNotificationsPage(){
 const el=document.querySelector('#notificationsList'); if(!el||!window.authState?.tripId)return;
 const isAdmin=window.authState?.member?.role==='admin';
 const [mr,ex,co,lo,it]=await Promise.all([
  isAdmin?window.sb.from('membership_requests').select('id,full_name,phone,requested_at').eq('trip_id',window.authState.tripId).eq('status','pending').order('requested_at',{ascending:false}):Promise.resolve({data:[],error:null}),
  window.sb.from('expenses').select('id,title,amount,created_at').eq('trip_id',window.authState.tripId).eq('status','pending').order('created_at',{ascending:false}),
  window.sb.from('fund_contributions').select('id,amount,created_at').eq('trip_id',window.authState.tripId).eq('status','pending').order('created_at',{ascending:false}),
  window.sb.from('locations').select('id,name,created_at').eq('trip_id',window.authState.tripId).eq('status','pending').order('created_at',{ascending:false}),
  window.sb.from('itinerary_items').select('id,title,item_date,created_at').eq('trip_id',window.authState.tripId).eq('status','pending').order('created_at',{ascending:false})
 ]);
 const items=[];
 (mr.data||[]).forEach(x=>items.push({icon:'👤',title:'درخواست عضویت جدید',text:x.full_name||'عضو جدید',page:'members'}));
 (ex.data||[]).forEach(x=>items.push({icon:'💰',title:'هزینه جدید برای تأیید',text:`${x.title||'هزینه'} • ${money(x.amount)}`,page:'pending'}));
 (co.data||[]).forEach(x=>items.push({icon:'🏦',title:'واریزی جدید صندوق',text:money(x.amount),page:'fund'}));
 (lo.data||[]).forEach(x=>items.push({icon:'📍',title:'پیشنهاد مکان جدید',text:x.name||'مکان جدید',page:'locations'}));
 (it.data||[]).forEach(x=>items.push({icon:'🗺️',title:'پیشنهاد برنامه جدید',text:x.title||'برنامه جدید',page:'itinerary'}));
 el.innerHTML=items.length?items.map(x=>`<div class="list-item notification-row" onclick="showPage('${x.page}')"><span class="notification-icon">${x.icon}</span><div><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.text)}</p><small>برای بررسی کلیک کنید ←</small></div></div>`).join(''):'<div class="empty-state">✅ درخواستی برای بررسی وجود ندارد.</div>';
}
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



window.toggleFinalSettlement=async()=>{
 if(window.authState?.member?.role!=='admin'){showPage('settlement');return;}
 const next=!state.settlementEnabled;
 const ok=confirm(next?'تسویه نهایی را برای همه اعضا فعال می‌کنید؟\nاین بخش باید فقط در پایان سفر فعال شود.':'تسویه نهایی را دوباره غیرفعال می‌کنید؟');
 if(!ok)return;
 const {error}=await window.sb.from('trips').update({settlement_enabled:next}).eq('id',window.authState.tripId);
 if(error){alert('تغییر وضعیت تسویه انجام نشد:\n'+(error.message||error.details||'خطای نامشخص'));return;}
 state.settlementEnabled=next;
 alert(next?'✅ تسویه نهایی برای اعضا فعال شد.':'🔒 تسویه نهایی برای اعضا غیرفعال شد.');
 showPage('members');
};

async function renderFinalSettlement(){
  const el=document.querySelector('#finalSettlement');
  if(!el || !window.authState?.tripId) return;
  try{
    await loadTripMembers();
    const f=await loadFinancialSummary();
    const t=f?.trip||{};
    const members=state.members||[];
    const byId=Object.fromEntries(members.map(m=>[String(m.id),m]));
    const memberFinancial=f?.members||[];
    const fundPaid=Object.fromEntries(memberFinancial.map(m=>[String(m.trip_member_id),Number(m.approved_contributions||0)]));
    const {data:expenses,error:ee}=await window.sb.from('expenses').select('id,title,amount,from_fund,payer_member_id,status').eq('trip_id',window.authState.tripId).eq('status','approved');
    if(ee) throw ee;
    const approved=expenses||[];
    const ids=approved.map(e=>e.id);
    let parts=[];
    if(ids.length){
      const {data:p,error:pe}=await window.sb.from('expense_participants').select('expense_id,trip_member_id').in('expense_id',ids);
      if(pe) throw pe; parts=p||[];
    }
    const partsByExpense={};
    for(const p of parts)(partsByExpense[p.expense_id] ||= []).push(p.trip_member_id);
    const fundExpenseShare=Object.fromEntries(members.map(m=>[String(m.id),0]));
    const personalNet=Object.fromEntries(members.map(m=>[String(m.id),0]));
    for(const e of approved){
      const pids=(partsByExpense[e.id]||[]).map(Number).filter(id=>byId[String(id)]);
      if(!pids.length) continue;
      const totalWeight=pids.reduce((sum,id)=>sum+Number(byId[String(id)].share_weight||0),0)||pids.length;
      for(const id of pids){
        const share=Number(e.amount||0)*Number(byId[String(id)].share_weight||1)/totalWeight;
        if(e.from_fund) fundExpenseShare[String(id)]=(fundExpenseShare[String(id)]||0)+share;
        else personalNet[String(id)]=(personalNet[String(id)]||0)-share;
      }
      if(!e.from_fund && e.payer_member_id!=null) personalNet[String(e.payer_member_id)]=(personalNet[String(e.payer_member_id)]||0)+Number(e.amount||0);
    }
    const fundRows=members.map(m=>{
      const id=String(m.id), paid=fundPaid[id]||0, expenseShare=fundExpenseShare[id]||0;
      return {...m,finalFundBalance:paid-expenseShare};
    });
    const fundBalance=Number(t.current_fund_balance||0);
    const surplus=Math.max(fundBalance,0), deficit=Math.max(-fundBalance,0);
    const transfers=buildSmartTransfers(members.map(m=>({trip_member_id:m.id,name:m.name,direct_paid:Math.max(personalNet[String(m.id)]||0,0),calculated_share:0})).map(x=>({...x, direct_paid:personalNet[String(x.trip_member_id)]>0?personalNet[String(x.trip_member_id)]:0, calculated_share:personalNet[String(x.trip_member_id)]<0?-personalNet[String(x.trip_member_id)]:0})));
    const myId=String(window.authState.member.id);
    const myFund=fundRows.find(m=>String(m.id)===myId);
    const myTransfers=transfers.filter(x=>x.from.id===myId||x.to.id===myId);
    let html=`<div class="final-fund-card"><div class="final-fund-title"><span>🏦</span><div><b>بستن حساب صندوق</b><small>موجودی فعلی صندوق پس از هزینه‌های تأییدشده</small></div></div><strong>${money(fundBalance)}</strong>${surplus?`<p class="fund-final-credit">🟢 ${money(surplus)} برای بازگشت به اعضا باقی مانده است.</p>`:deficit?`<p class="fund-final-debt">🔴 صندوق ${money(deficit)} کسری دارد و باید از اعضای بدهکار تأمین شود.</p>`:`<p class="fund-final-settled">✅ موجودی صندوق دقیقاً تسویه شده است.</p>`}</div>`;
    html+=`<div class="section-head"><h3>📋 وضعیت نهایی سهم اعضا از صندوق</h3></div>`;
    html+=fundRows.map(m=>{const b=Number(m.finalFundBalance||0);const label=b>1?'طلب از صندوق':b<-1?'بدهی به صندوق':'تسویه';return `<div class="list-item"><b>${escapeHtml(m.name)}</b><span class="badge ${b>1?'approved':b<-1?'pending':'approved'}">${label}</span><p>واریزی تأییدشده: ${money(fundPaid[String(m.id)]||0)}</p><small>سهم هزینه‌های صندوق: ${money(fundExpenseShare[String(m.id)]||0)} • ${b>1?`قابل برگشت: ${money(b)}`:b<-1?`قابل وصول: ${money(-b)}`:'بدون مانده'}</small></div>`}).join('');
    html+=`<div class="final-settlement-personal"><div class="section-head"><h3>🤝 تسویه بین اعضا</h3></div><p class="muted">فقط هزینه‌های تأییدشده‌ای که شخصاً توسط یک عضو پرداخت شده‌اند در این بخش محاسبه می‌شوند.</p>`;
    if(myTransfers.length){ html+=`<div class="personal-final-highlight"><b>وضعیت شما</b>${myTransfers.map(x=>x.from.id===myId?`<div class="finance-msg debt"><span>👤</span><div><b>باید به ${escapeHtml(x.to.name)} پرداخت کنید</b><strong>${money(x.amount)} تومان</strong></div></div>`:`<div class="finance-msg credit"><span>👤</span><div><b>${escapeHtml(x.from.name)} باید به شما پرداخت کند</b><strong>${money(x.amount)} تومان</strong></div></div>`).join('')}</div>`; }
    html+=transfers.length?transfers.map(x=>`<div class="list-item transfer-row"><b>💸 ${escapeHtml(x.from.name)} ← ${escapeHtml(x.to.name)}</b><strong>${money(x.amount)}</strong></div>`).join(''):'<div class="empty-state">بین اعضا بدهی یا طلبی برای تسویه نهایی وجود ندارد.</div>';
    html+=`</div>`;
    if(!transfers.length && !myTransfers.length && myFund) html+=`<div class="settlement-note">${myFund.finalFundBalance>1?'🟢 سهم شما از مانده صندوق قابل برگشت است.':myFund.finalFundBalance<-1?'🔴 شما در تسویه نهایی صندوق بدهکار هستید.':'✅ حساب شما در صندوق تسویه است.'}</div>`;
    el.innerHTML=html;
  }catch(e){console.error('final settlement',e);el.innerHTML=`<div class="empty-state">محاسبه تسویه نهایی انجام نشد.<br><small>${escapeHtml(e.message||'خطای نامشخص')}</small></div>`;}
}

// ===== PWA install + personal financial notice (v13.7) =====
window.deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredInstallPrompt = e;
  document.querySelectorAll('.pwa-install-trigger').forEach(el => el.classList.add('ready'));
});
window.addEventListener('appinstalled', () => {
  window.deferredInstallPrompt = null;
  showToast?.('✅ برنامه با موفقیت روی دستگاه نصب شد');
});
window.installPWA = async function(){
  const p = window.deferredInstallPrompt;
  if (p) {
    p.prompt();
    const choice = await p.userChoice;
    if (choice?.outcome === 'accepted') showToast?.('✅ نصب برنامه شروع شد');
    window.deferredInstallPrompt = null;
    return;
  }
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) {
    alert('برای نصب در Chrome، از منوی ⋮ گزینه «Install app / نصب برنامه» یا «Add to Home screen / افزودن به صفحه اصلی» را انتخاب کنید.');
  } else {
    alert('این برنامه یک PWA است. در مرورگر پشتیبانی‌شده گزینه Install / Add to Home Screen را انتخاب کنید.');
  }
};

function buildSmartTransfers(members){
  const eps=1;
  const creditors=[], debtors=[];
  for(const m of members||[]){
    const balance=Number(m.direct_paid||0)-Number(m.calculated_share||0);
    if(balance>eps) creditors.push({id:String(m.trip_member_id),name:m.name,amount:balance});
    else if(balance<-eps) debtors.push({id:String(m.trip_member_id),name:m.name,amount:-balance});
  }
  creditors.sort((a,b)=>b.amount-a.amount); debtors.sort((a,b)=>b.amount-a.amount);
  const transfers=[]; let i=0,j=0;
  while(i<debtors.length && j<creditors.length){
    const amount=Math.min(debtors[i].amount,creditors[j].amount);
    if(amount>eps) transfers.push({from:debtors[i],to:creditors[j],amount});
    debtors[i].amount-=amount; creditors[j].amount-=amount;
    if(debtors[i].amount<=eps)i++; if(creditors[j].amount<=eps)j++;
  }
  return transfers;
}
window.renderPersonalFinancialNotice = async function(showPopup=false){
  try{
    if(!window.authState?.session || !window.authState?.member?.id) return;
    const f=await loadFinancialSummary();
    const members=f?.members||[];
    const myId=String(window.authState.member.id);
    const me=members.find(x=>String(x.trip_member_id)===myId);
    if(!me) return;
    const fundTarget=Number(me.contribution_target||0), fundPaid=Number(me.approved_contributions||0);
    const fundDiff=fundPaid-fundTarget;
    const rows=[];
    if(fundDiff<0) rows.push(`<div class="finance-msg debt"><span>🏦</span><div><b>بدهی شما به صندوق</b><strong>${money(-fundDiff)} تومان</strong><small>مبلغ موردنیاز صندوق شما هنوز کامل پرداخت نشده است.</small></div></div>`);
    else if(fundDiff>0) rows.push(`<div class="finance-msg credit"><span>🏦</span><div><b>طلب شما از صندوق</b><strong>${money(fundDiff)} تومان</strong><small>پرداخت شما بیشتر از تعهد فعلی صندوق است.</small></div></div>`);
    else rows.push(`<div class="finance-msg settled"><span>✅</span><div><b>سهم شما از صندوق تسویه است</b><small>تعهد صندوق شما به‌طور کامل پرداخت شده است.</small></div></div>`);
    rows.push(`<div class="finance-stage-note"><span>ℹ️</span><div><b>تسویه با اعضا در پایان سفر</b><small>در پایان سفر، اگر هزینه‌ای توسط اعضا شخصاً پرداخت شده باشد، بدهی یا طلب بین افراد در بخش «تسویه نهایی» محاسبه می‌شود.</small></div></div>`);
    const summary=`<div class="personal-finance-card"><div class="personal-finance-head"><div><small>وضعیت مالی من</small><h3>${escapeHtml(me.name||'عضو سفر')}</h3></div><span>🏦</span></div>${rows.join('')}<button class="btn small" onclick="showPage('settlement')">💸 مشاهده تسویه نهایی</button></div>`;
    const target=document.querySelector('#personalFinanceNotice'); if(target) target.innerHTML=summary;
    if(showPopup){
      const key=`finance-notice:${window.authState.tripId}:${myId}`;
      if(!sessionStorage.getItem(key)){
        sessionStorage.setItem(key,'1');
        const m=document.querySelector('#modal');
        if(m){m.innerHTML=`<div class="sheet finance-popup"><button class="close" onclick="closeModal()">×</button><div class="finance-popup-icon">🏦</div><h2>وضعیت صندوق شما</h2><p class="muted">وضعیت پرداخت سهم شما در این مرحله از سفر</p>${rows.join('')}<button class="btn" onclick="closeModal();showPage('settlement')">💸 تسویه نهایی سفر</button></div>`;m.classList.remove('hidden');}
      }
    }
  }catch(e){console.error('personal finance notice',e)}
};
