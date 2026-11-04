import { supabase } from "./supabase.js";
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const msg = (text,type="error") => { const el=$("pageMessage"); if(el){el.textContent=text;el.className=`form-message ${type}`;} };
const groups=["A+","A-","B+","B-","AB+","AB-","O+","O-"];
let requests=[], activeGroup="all";

async function init(){
 const {data:{session},error:sessionError}=await supabase.auth.getSession();
 if(sessionError||!session){location.href="admin-login.html";return;}
 const {data:profile,error}=await supabase.from("profiles").select("role,status").eq("id",session.user.id).maybeSingle();
 if(error||!profile||profile.role!=="admin"||profile.status!=="active"){await supabase.auth.signOut();location.href="admin-login.html";return;}
 await Promise.all([loadStats(),loadRequests(),loadInventory()]);
}
async function loadStats(){
 const {data,error}=await supabase.rpc("admin_dashboard_stats");
 if(error){console.error(error);msg(error.message);return;}
 const s=data||{}; $("statDonors").textContent=s.donors??0; $("statPatients").textContent=s.patients??0; $("statRequests").textContent=s.requests??0; $("statEmergency").textContent=s.emergency??0;
}
function openDetail(title,eyebrow){$("detailTitle").textContent=title;$("detailEyebrow").textContent=eyebrow;$("adminDetailPanel").classList.add("show");$("adminDetailPanel").scrollIntoView({behavior:"smooth",block:"start"});}
function row(label,value,cls=""){return `<div class="record-row"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`;}
async function loadDonors(){
 const box=$("adminDetailContent");box.innerHTML='<p class="muted">Loading donors...</p>';
 const {data,error}=await supabase.rpc("admin_dashboard_donors");
 if(error){box.innerHTML=`<p class="form-message error">${esc(error.message)}</p>`;return;}
 if(!data?.length){box.innerHTML='<p class="muted">No donor records found.</p>';return;}
 box.innerHTML=`<p class="muted">${data.length} donor record(s)</p><div class="record-grid">${data.map(d=>`<article class="record-card"><h3>🩸 ${esc(d.full_name||"Unknown Donor")}</h3>${row("Blood group",d.blood_group||"Not set")}${row("Mobile",d.mobile||"Not available")}${row("Email",d.email||"Not available")}${row("City",d.city||"Not set")}${row("Availability",d.availability===true?"Available":"Not available",d.availability===true?"good":"bad")}${row("Emergency",d.emergency_available===true?"Enabled":"Disabled")}${row("Last donation",d.last_donation_date||"Not recorded")}${row("Account status",d.status||"Active")}</article>`).join("")}</div>`;
}
async function loadPatients(){
 const box=$("adminDetailContent");box.innerHTML='<p class="muted">Loading patients...</p>';
 const {data,error}=await supabase.rpc("admin_dashboard_patients");
 if(error){box.innerHTML=`<p class="form-message error">${esc(error.message)}</p>`;return;}
 if(!data?.length){box.innerHTML='<p class="muted">No patient records found.</p>';return;}
 box.innerHTML=`<p class="muted">${data.length} patient record(s)</p><div class="record-grid">${data.map(p=>`<article class="record-card"><h3>👤 ${esc(p.full_name||"Patient")}</h3>${row("Blood group",p.blood_group||"Not set")}${row("Mobile",p.mobile||"Not available")}${row("Email",p.email||"Not available")}${row("City",p.city||"Not set")}${row("Account status",p.status||"—")}</article>`).join("")}</div>`;
}
async function loadDetailRequests(emergencyOnly){
 const box=$("adminDetailContent");box.innerHTML='<p class="muted">Loading requests...</p>';
 const {data,error}=await supabase.rpc("admin_dashboard_requests");
 if(error){box.innerHTML=`<p class="form-message error">${esc(error.message)}</p>`;return;}
 const rows=(data||[]).filter(r=>!emergencyOnly||String(r.priority||"").toLowerCase()==="emergency");
 if(!rows.length){box.innerHTML='<p class="muted">No matching requests found in the latest 20 records.</p>';return;}
 box.innerHTML=`<div class="record-grid">${rows.map(r=>`<article class="record-card"><h3>🩸 ${esc(r.blood_group)} · ${esc(r.units_required)} unit(s)</h3>${row("City / Hospital",`${r.city||"—"}${r.hospital_name?" · "+r.hospital_name:""}`)}${row("Priority",r.priority||"normal")}${row("Status",r.status||"pending")}${row("Required date",r.required_date||"Not specified")}</article>`).join("")}</div>`;
}
async function showDetail(section){
 document.querySelectorAll(".stats article").forEach(c=>c.classList.remove("active"));
 $(`${section}StatCard`)?.classList.add("active");
 if(section==="donors"){openDetail("Donor Records","DONOR MANAGEMENT");await loadDonors();}
 if(section==="patients"){openDetail("Patient Records","PATIENT MANAGEMENT");await loadPatients();}
 if(section==="requests"){openDetail("All Blood Requests","REQUEST MANAGEMENT");await loadDetailRequests(false);}
 if(section==="emergency"){openDetail("Emergency Requests","EMERGENCY MANAGEMENT");await loadDetailRequests(true);}
}
["donors","patients","requests","emergency"].forEach(s=>{
 const card=$(`${s}StatCard`);card?.addEventListener("click",()=>showDetail(s));
 card?.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();showDetail(s);}});
});
document.querySelectorAll("[data-open-detail]").forEach(b=>b.addEventListener("click",()=>showDetail(b.dataset.openDetail)));
$("closeDetail")?.addEventListener("click",()=>{$("adminDetailPanel").classList.remove("show");document.querySelectorAll(".stats article").forEach(c=>c.classList.remove("active"));});

const norm = v => String(v||"").trim().toUpperCase().replace("−","-");
async function loadRequests(){
 const box=$("adminRequests");box.innerHTML='<p class="muted">Loading requests...</p>';
 const {data,error}=await supabase.rpc("admin_dashboard_requests");
 if(error){console.error(error);box.innerHTML=`<p class="form-message error">${esc(error.message)}</p>`;$("requestCount").textContent="Unavailable";return;}
 requests=data||[];$("requestCount").textContent=`${requests.length} total`;renderRequests();
}
function renderRequests(){
 const rows=activeGroup==="all"?requests:requests.filter(r=>norm(r.blood_group)===activeGroup);
 $("requestListTitle").textContent=activeGroup==="all"?"All requests":`${activeGroup} requests`;
 $("filteredRequestCount").textContent=`${rows.length} found`;
 const box=$("adminRequests");
 if(!rows.length){box.innerHTML=`<div class="empty-state"><span>🩸</span><div><b>No ${activeGroup==="all"?"":activeGroup+" "}requests found</b><p>New requests for this blood group will appear here.</p></div></div>`;return;}
 box.innerHTML=rows.map(r=>{
  const status=String(r.status||"pending").toLowerCase(),priority=String(r.priority||"normal").toLowerCase();
  const created=r.created_at?new Date(r.created_at).toLocaleString():"—";
  return `<article class="request-card"><div class="request-main"><div class="request-top"><b>🩸 ${esc(r.blood_group||"—")} · ${esc(r.units_required??"—")} unit(s)</b><span class="status-badge ${status}">${esc(status)}</span></div><p class="request-location">📍 ${esc(r.city||"—")}${r.hospital_name?" · "+esc(r.hospital_name):""}</p><div class="request-meta"><span class="${priority==="emergency"?"urgent":""}">Priority: ${esc(priority)}</span><span>Required: ${esc(r.required_date||"Not specified")}</span><span>Created: ${esc(created)}</span></div></div><label class="status-control">Update status<select class="status-select" data-id="${esc(r.id)}">${["pending","accepted","processing","fulfilled","rejected","cancelled"].map(v=>`<option value="${v}" ${status===v?"selected":""}>${v[0].toUpperCase()+v.slice(1)}</option>`).join("")}</select></label></article>`;
 }).join("");
 box.querySelectorAll(".status-select").forEach(sel=>sel.addEventListener("change",()=>updateStatus(sel)));
}
document.querySelectorAll(".filter-btn").forEach(btn=>btn.addEventListener("click",()=>{
 activeGroup=btn.dataset.bloodGroup;document.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===btn));renderRequests();
}));
async function updateStatus(select){
 const id=select.dataset.id,status=select.value;if(!id||!status)return;select.disabled=true;msg("Updating request status...","info");
 const {data,error}=await supabase.rpc("admin_update_request_status",{p_request_id:id,p_status:status});select.disabled=false;
 if(error){msg(error.message);await loadRequests();return;}
 if(data!==true){msg("The request status could not be updated.");await loadRequests();return;}
 msg("Request status updated successfully.","success");await Promise.all([loadRequests(),loadStats()]);
}
async function loadInventory(){
 const box=$("inventory");box.innerHTML='<p class="muted">Loading inventory...</p>';
 const {data,error}=await supabase.rpc("admin_dashboard_inventory");
 if(error){console.error(error);box.innerHTML=`<p class="form-message error">${esc(error.message)}</p>`;return;}
 const byGroup=new Map((data||[]).map(i=>[norm(i.blood_group),i]));
 box.innerHTML=groups.map(g=>{
  const item=byGroup.get(g),available=item?.units_available??0,reserved=item?.units_reserved??0,low=available<=2;
  const updated=item?.last_updated?new Date(item.last_updated).toLocaleString():"—";
  return `<article class="inventory-card ${low?"low":""}"><div class="inventory-top"><span>🩸</span><small class="${low?"low-text":"good-text"}">${low?"Low stock":"Available"}</small></div><h3>${g}</h3><b class="units">${esc(available)}</b><span class="muted tiny">available units</span><div class="inventory-foot"><span>${esc(reserved)} reserved</span><small>Updated: ${esc(updated)}</small></div></article>`;
 }).join("");
}
document.querySelectorAll('.nav-link[href^="#"]').forEach(a=>a.addEventListener("click",()=>{document.querySelectorAll(".nav-link").forEach(n=>n.classList.remove("active"));a.classList.add("active");}));
$("logout")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.href="index.html";});
init();
