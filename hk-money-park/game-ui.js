function updateHud(){
  $('walletTotal').textContent=fmt(totalWallet());
  if(state.phase==='idle'){$('missionText').textContent='先去搵媽媽接任務';$('missionSub').textContent='行近媽媽，再按「互動」'}
  else if(state.phase==='shopping'){
    const remain=state.mission.filter(id=>!state.purchased.includes(id));
    $('missionText').textContent=remain.length?'購物清單：'+remain.map(id=>byId[id].name).join('、'):'已買齊！返去搵媽媽';
    $('missionSub').textContent=`第 ${state.level+1} 關｜任務 ${fmt(missionTotal())}｜媽媽給 ${fmt(missionAllowance())}`;
  }else{$('missionText').textContent='任務完成！';$('missionSub').textContent='返回媽媽開始下一關'}
  $('inventoryPanel').style.display=state.purchased.length?'block':'none';
  $('inventoryItems').innerHTML=state.purchased.map(id=>`<span class="invTag">${byId[id].emoji}${byId[id].name}</span>`).join('');
}
function renderShoppingList(){
  $('shoppingList').innerHTML=state.mission.map(id=>{
    const p=byId[id],done=state.purchased.includes(id);return `<div class="listItem ${done?'done':''}"><span>${done?'✅':'⬜'} ${p.emoji} ${p.name}</span><span>${fmt(p.price)}</span></div>`
  }).join('')+`<div class="listItem"><span>任務合共</span><span>${fmt(missionTotal())}</span></div><div class="listItem"><span>媽媽給你的購物金</span><span>${fmt(missionAllowance())}</span></div>`;
}
function momInteract(){
  $('dialogTitle').textContent='👩 媽媽';$('dialogActions').innerHTML='';
  if(state.phase==='idle'){
    state.mission=MISSIONS[state.level % MISSIONS.length].slice();
    $('dialogBody').innerHTML=`小朋友，我想請你幫手買以下物品。<br><strong>我會畀你多過任務總額嘅購物金。唔好將所有錢都俾店員，要睇清楚每次應付幾多！</strong>`;
    renderShoppingList();
    const btn=document.createElement('button');btn.className='primary';btn.textContent=`接任務並收取 ${fmt(missionAllowance())}`;btn.onclick=()=>{state.phase='shopping';state.purchased=[];prepareWalletForMission();close('dialogOverlay');toast(`媽媽給你 ${fmt(missionAllowance())}，請只支付每次正確金額！`,3000);speak('媽媽畀咗多啲錢你。記得睇清楚價錢，只支付正確金額，唔好將全部錢俾店員。');updateHud();beep(650,.12)};$('dialogActions').appendChild(btn);
  } else if(state.phase==='shopping'){
    if(isMissionComplete()){$('dialogBody').innerHTML=`你買齊晒喇！價錢同物品都正確，做得好！🌟`;renderShoppingList();const btn=document.createElement('button');btn.className='primary';btn.textContent='交付任務';btn.onclick=finishMission;$('dialogActions').appendChild(btn)}
    else{$('dialogBody').innerHTML=`仲有物品未買齊。睇睇清單，再去相應店舖啦。`;renderShoppingList();const reset=document.createElement('button');reset.className='secondary';reset.textContent='重新開始本關';reset.onclick=resetMission;$('dialogActions').appendChild(reset)}
  } else {$('dialogBody').innerHTML=`今次任務完成！準備好可以開始下一張購物清單。`;$('shoppingList').innerHTML='';const btn=document.createElement('button');btn.className='primary';btn.textContent='開始下一關';btn.onclick=()=>{state.phase='idle';state.mission=[];state.purchased=[];state.wallet={};updateHud();close('dialogOverlay');toast('行近媽媽再次接任務')};$('dialogActions').appendChild(btn)}
  open('dialogOverlay');
}
function resetMission(){state.purchased=[];state.tray=[];prepareWalletForMission();close('dialogOverlay');toast('已重設本關，金錢已放回銀包')}
function finishMission(){state.phase='complete';state.score++;state.level++;state.wallet={};updateHud();close('dialogOverlay');confetti();speak('任務完成，做得非常好！');beep(780,.15);setTimeout(()=>beep(980,.15),150);toast('🌟 任務完成！',2600)}
function confetti(){for(let i=0;i<45;i++){const e=document.createElement('div');e.className='confetti';e.style.left=Math.random()*100+'vw';e.style.background=`hsl(${Math.random()*360} 85% 60%)`;e.style.setProperty('--dx',(Math.random()*200-100)+'px');e.style.animationDelay=Math.random()*.5+'s';document.body.appendChild(e);setTimeout(()=>e.remove(),2500)}}
function openShop(shopId){state.selectedShop=shopId;state.cart=[];const info=SHOP_INFO[shopId];$('shopEmoji').textContent=info.emoji;$('shopTitle').textContent=info.name;$('shopSubtitle').textContent='只選購媽媽清單上、而且未買的物品';renderProducts();open('shopOverlay');beep(580,.07)}
function renderProducts(){
  const shop=state.selectedShop;$('products').innerHTML='';
  PRODUCTS[shop].forEach(p=>{const needed=state.mission.includes(p.id)&&!state.purchased.includes(p.id);const bought=state.purchased.includes(p.id);const el=document.createElement('button');el.className='product'+(state.cart.includes(p.id)?' selected':'')+(!needed?' locked':'');el.innerHTML=`<span class="check">✓</span><span class="emoji">${p.emoji}</span><span class="name">${p.name}</span><span class="price">${fmt(p.price)}</span>${bought?'<small>已購買</small>':!state.mission.includes(p.id)?'<small>不在清單</small>':''}`;el.onclick=()=>{if(!needed){toast(bought?'呢件已經買咗':'呢件唔喺媽媽嘅清單上');beep(180,.12);return}const i=state.cart.indexOf(p.id);if(i>=0)state.cart.splice(i,1);else state.cart.push(p.id);renderProducts();beep(520,.05)};$('products').appendChild(el)});
  const sum=state.cart.reduce((s,id)=>s+byId[id].price,0);$('cartInfo').textContent=state.cart.length?`已選 ${state.cart.length} 件｜${fmt(sum)}`:'未選貨品';$('toCheckoutBtn').disabled=!state.cart.length;
}
$('toCheckoutBtn').onclick=()=>{state.tray=[];close('shopOverlay');renderCheckout();open('checkoutOverlay')};
$('cancelCheckout').onclick=()=>{returnTray();close('checkoutOverlay');renderProducts();open('shopOverlay')};
$('clearTray').onclick=()=>{returnTray();renderCheckout()};
function checkoutDue(){return state.cart.reduce((s,id)=>s+byId[id].price,0)}
function renderCheckout(){
  const due=checkoutDue(),paid=totalTray();$('checkoutSummary').textContent=state.cart.map(id=>`${byId[id].emoji}${byId[id].name}`).join(' + ');$('amountDue').textContent=fmt(due);$('paidAmount').textContent=fmt(paid);const diff=due-paid;$('payFeedback').textContent=diff>0?`尚欠 ${fmt(diff)}`:diff<0?`多咗 ${fmt(-diff)}，請取回`:'✅ 金額正確';$('payFeedback').style.color=diff===0?'#ffe36e':diff<0?'#ff9e9e':'#fff';$('payBtn').disabled=diff!==0;$('tray').classList.toggle('hasMoney',state.tray.length>0);$('tray').innerHTML=state.tray.map((v,i)=>`<button class="trayMoney" data-i="${i}" title="按一下取回">${moneyLabel(v)} ↩</button>`).join('');$('tray').querySelectorAll('.trayMoney').forEach(b=>b.onclick=()=>{const i=+b.dataset.i,v=state.tray.splice(i,1)[0];state.wallet[v]=(state.wallet[v]||0)+1;renderCheckout();updateHud();beep(390,.05)});renderWallet();
}
function moneyLabel(v){const d=DENOMS.find(x=>x.v===v&&((v!==1000)||x.type==='coin'))||DENOMS.find(x=>x.v===v);return d?d.label:fmt(v)}
function renderWallet(){
  $('wallet').innerHTML='';DENOMS.forEach(d=>{const count=state.wallet[d.v]||0;const el=document.createElement('div');el.className=`moneyItem ${d.type} ${d.metal||''} ${count?'':'zero'}`;let visual=d.img?`<img class="realMoney" src="${d.img}" alt="香港${d.label}紙幣樣本" draggable="false"><span class="moneyValue">${d.label}</span>`:`<div class="coinFace"><div>${d.label}<small style="display:block;font-size:9px;margin-top:4px">香港</small></div></div><span class="moneyValue">${d.label}</span>`;el.innerHTML=visual+`<span class="count">${count}</span>`;el.dataset.value=d.v;el.setAttribute('role','button');el.setAttribute('aria-label',`${d.label}，有${count}個`);const img=el.querySelector('img');if(img)img.onerror=()=>{img.style.display='none';el.insertAdjacentHTML('afterbegin',`<div class="coinFace"><div>${d.label}<small style="display:block;font-size:9px;margin-top:4px">香港</small></div></div>`)};installMoneyDrag(el,d.v);$('wallet').appendChild(el)});
}
function installMoneyDrag(el,value){el.addEventListener('pointerdown',e=>{if(!(state.wallet[value]>0))return;e.preventDefault();el.setPointerCapture?.(e.pointerId);const ghost=el.cloneNode(true);ghost.classList.add('dragGhost');ghost.classList.remove('zero');ghost.querySelector('.count')?.remove();document.body.appendChild(ghost);const move=ev=>{ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px'};move(e);const up=ev=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);ghost.remove();const r=$('tray').getBoundingClientRect();if(ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom){state.wallet[value]--;state.tray.push(value);beep(610,.05);renderCheckout();updateHud()}else beep(300,.04)};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)})}
function returnTray(){state.tray.forEach(v=>state.wallet[v]=(state.wallet[v]||0)+1);state.tray=[];updateHud()}
$('payBtn').onclick=()=>{if(totalTray()!==checkoutDue())return;state.cart.forEach(id=>state.purchased.push(id));state.tray=[];state.cart=[];close('checkoutOverlay');updateHud();beep(720,.12);speak('付款正確，多謝。');toast(isMissionComplete()?'付款正確！已買齊，返去交畀媽媽啦':'付款正確！繼續去其他店舖',3000)};
