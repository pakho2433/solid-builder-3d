'use strict';

// 所有金額均以「仙」儲存，避免 0.1 + 0.2 的浮點誤差。
const $ = id => document.getElementById(id);
const fmt = cents => '$' + (cents / 100).toFixed(2);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

const PRODUCTS = {
  snack: [
    {id:'chips', name:'薯片', emoji:'🥔', price:650},
    {id:'cookies', name:'曲奇餅', emoji:'🍪', price:480},
    {id:'candy', name:'水果糖', emoji:'🍬', price:230},
    {id:'seaweed', name:'紫菜', emoji:'🟩', price:390},
    {id:'popcorn', name:'爆谷', emoji:'🍿', price:720},
    {id:'cracker', name:'梳打餅', emoji:'🧇', price:560}
  ],
  toy: [
    {id:'teddy', name:'啤啤熊', emoji:'🧸', price:1850},
    {id:'robot', name:'小機械人', emoji:'🤖', price:2200},
    {id:'ball', name:'彩色皮球', emoji:'⚽', price:1280},
    {id:'dino', name:'恐龍公仔', emoji:'🦖', price:1680},
    {id:'car', name:'玩具車', emoji:'🚗', price:1450},
    {id:'blocks', name:'積木', emoji:'🧱', price:1980}
  ],
  balloon: [
    {id:'redBalloon', name:'紅色氣球', emoji:'🎈', price:350},
    {id:'blueBalloon', name:'藍色氣球', emoji:'🔵', price:350},
    {id:'starBalloon', name:'星星氣球', emoji:'⭐', price:680},
    {id:'heartBalloon', name:'心形氣球', emoji:'💗', price:750},
    {id:'animalBalloon', name:'動物氣球', emoji:'🐶', price:880},
    {id:'rainbowBalloon', name:'彩虹氣球', emoji:'🌈', price:920}
  ],
  drink: [
    {id:'juice', name:'紙包果汁', emoji:'🧃', price:280},
    {id:'water', name:'樽裝水', emoji:'💧', price:450},
    {id:'milk', name:'鮮奶', emoji:'🥛', price:620},
    {id:'tea', name:'檸檬茶', emoji:'🍋', price:580},
    {id:'soy', name:'豆奶', emoji:'🫘', price:520},
    {id:'cocoa', name:'朱古力奶', emoji:'🍫', price:690}
  ]
};
const SHOP_INFO = {
  snack:{name:'零食店',emoji:'🍪',color:0xf1a83b,pos:new THREE.Vector3(-13,0,-9)},
  toy:{name:'公仔店',emoji:'🧸',color:0xef78a7,pos:new THREE.Vector3(13,0,-9)},
  balloon:{name:'氣球店',emoji:'🎈',color:0x8c72df,pos:new THREE.Vector3(-13,0,10)},
  drink:{name:'飲品店',emoji:'🧃',color:0x54a9df,pos:new THREE.Vector3(13,0,10)}
};
const allProducts = Object.values(PRODUCTS).flat();
const byId = Object.fromEntries(allProducts.map(p => [p.id,p]));
const productShop = {};
Object.entries(PRODUCTS).forEach(([s,ps])=>ps.forEach(p=>productShop[p.id]=s));

const MISSIONS = [
  ['chips','juice'],
  ['cookies','redBalloon'],
  ['candy','water','blueBalloon'],
  ['seaweed','milk'],
  ['teddy','juice'],
  ['ball','tea','chips'],
  ['dino','starBalloon'],
  ['car','soy','cookies'],
  ['blocks','heartBalloon','water'],
  ['robot','animalBalloon','cocoa']
];

const DENOMS = [
  {v:5000,label:'$50',type:'note',img:'https://www.hkma.gov.hk/media/eng/img/key-functions/money/notes-and-coins/notes/design-security-features-of-currency-notes/2018/HSBC/50/HSBC_50_%28Front%29.jpg'},
  {v:2000,label:'$20',type:'note',img:'https://www.hkma.gov.hk/media/eng/img/key-functions/money/notes-and-coins/notes/design-security-features-of-currency-notes/2018/HSBC/20/HSBC_20_%28Front%29.jpg'},
  {v:1000,label:'$10',type:'note',img:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/HKD_10_2002_%282002%29.jpg/640px-HKD_10_2002_%282002%29.jpg'},
  {v:500,label:'$5',type:'coin',metal:'silver'},
  {v:200,label:'$2',type:'coin',metal:'silver scallop'},
  {v:100,label:'$1',type:'coin',metal:'silver'},
  {v:50,label:'50¢',type:'coin',metal:'gold'},
  {v:20,label:'20¢',type:'coin',metal:'gold scallop'},
  {v:10,label:'10¢',type:'coin',metal:'gold'}
];
const PAY_DENOMS = [5000,2000,1000,500,200,100,50,20,10];

let state = {
  started:false, sound:true, phase:'idle', level:0, mission:[], purchased:[],
  wallet:{}, tray:[], score:0, selectedShop:null, cart:[], currentTarget:null
};

function totalWallet(){return Object.entries(state.wallet).reduce((s,[v,c])=>s+(+v)*c,0)}
function totalTray(){return state.tray.reduce((s,v)=>s+v,0)}
function missionTotal(){return state.mission.reduce((s,id)=>s+byId[id].price,0)}
function missionAllowance(){const total=missionTotal();return total<=2000?2000:5000}
function isMissionComplete(){return state.mission.every(id=>state.purchased.includes(id))}
function decompose(amount){const out={};for(const d of PAY_DENOMS){const n=Math.floor(amount/d);if(n){out[d]=(out[d]||0)+n;amount-=n*d}}if(amount!==0)console.warn('未能完整拆分',amount);return out}
function prepareWalletForMission(){state.wallet={};const groups={};state.mission.forEach(id=>{const s=productShop[id];groups[s]=(groups[s]||0)+byId[id].price});Object.values(groups).forEach(sub=>{const bits=decompose(sub);Object.entries(bits).forEach(([v,n])=>state.wallet[v]=(state.wallet[v]||0)+n)});const extra=missionAllowance()-missionTotal();const distractors=decompose(extra);Object.entries(distractors).forEach(([v,n])=>state.wallet[v]=(state.wallet[v]||0)+n);updateHud()}

function beep(freq=520,dur=.08){if(!state.sound)return;try{const ac=beep.ac||(beep.ac=new (window.AudioContext||window.webkitAudioContext)());const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.08,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+dur)}catch(e){}}
function speak(text){if(!state.sound||!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='zh-HK';u.rate=.95;u.pitch=1.05;speechSynthesis.speak(u)}
function toast(text,ms=2200){const m=$('message');m.textContent=text;m.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>m.classList.remove('show'),ms)}
function open(id){$(id).classList.add('open');controlsLocked=true}
function close(id){$(id).classList.remove('open');controlsLocked=document.querySelector('.overlay.open')!==null}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>close(b.dataset.close)));
