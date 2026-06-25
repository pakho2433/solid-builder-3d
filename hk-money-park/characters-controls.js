function makePerson(colors={shirt:0xef6c75,pants:0x3f608f},scale=1,withBackpack=false){
  const g=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0xf2b88e,roughness:.9});
  const shirt=new THREE.MeshStandardMaterial({color:colors.shirt,roughness:.88});
  const pants=new THREE.MeshStandardMaterial({color:colors.pants,roughness:.92});
  const white=new THREE.MeshStandardMaterial({color:0xfffbf2,roughness:.85});
  const hairMat=new THREE.MeshStandardMaterial({color:0x3a251d,roughness:.94});

  const bodyRoot=new THREE.Group(); g.add(bodyRoot);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.12,.13,.18,12),skin);neck.position.y=2.02;bodyRoot.add(neck);
  const headPivot=new THREE.Group();headPivot.position.y=2.35;bodyRoot.add(headPivot);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.44,28,22),skin);headPivot.add(head);
  const cheekL=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshStandardMaterial({color:0xf4a4a4,transparent:true,opacity:.58}));cheekL.position.set(-.17,-.08,.34);headPivot.add(cheekL);
  const cheekR=cheekL.clone();cheekR.position.x=.17;headPivot.add(cheekR);
  [-.14,.14].forEach(x=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.038,10,8),new THREE.MeshStandardMaterial({color:0x2a241f,roughness:.8}));eye.position.set(x,.03,.39);headPivot.add(eye)});
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),skin);nose.position.set(0,-.045,.435);headPivot.add(nose);
  const smile=new THREE.Mesh(new THREE.TorusGeometry(.085,.018,7,14,Math.PI),new THREE.MeshStandardMaterial({color:0x9f4d4d,roughness:.8}));smile.rotation.z=Math.PI;smile.position.set(0,-.14,.405);headPivot.add(smile);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.47,24,18,0,Math.PI*2,0,Math.PI*.67),hairMat);hair.position.y=.10;headPivot.add(hair);
  const fringe=new THREE.Mesh(new THREE.SphereGeometry(.26,16,12,0,Math.PI*2,0,Math.PI*.55),hairMat);fringe.position.set(0,.14,.22);fringe.scale.set(1.3,.8,1.1);headPivot.add(fringe);
  for(let i=0;i<5;i++){const tuft=new THREE.Mesh(new THREE.SphereGeometry(.15,10,8),hairMat);tuft.position.set((i-2)*.14,.34,.10-Math.abs(i-2)*.03);headPivot.add(tuft)}

  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.50,.82,7,16),shirt);torso.position.y=1.45;bodyRoot.add(torso);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.23,.045,10,20),white);collar.rotation.x=Math.PI/2;collar.position.set(0,1.78,.02);bodyRoot.add(collar);
  const shirtBand=new THREE.Mesh(new THREE.TorusGeometry(.40,.035,8,24),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8}));shirtBand.rotation.x=Math.PI/2;shirtBand.position.set(0,1.14,.02);bodyRoot.add(shirtBand);

  const arms=[];
  [-1,1].forEach((side,i)=>{
    const armPivot=new THREE.Group();armPivot.position.set(side*.42,1.72,0);bodyRoot.add(armPivot);
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(.15,12,10),shirt);armPivot.add(shoulder);
    const sleeve=new THREE.Mesh(new THREE.CapsuleGeometry(.135,.20,5,9),shirt);sleeve.position.y=-.13;armPivot.add(sleeve);
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.48,5,9),skin);arm.position.y=-.47;armPivot.add(arm);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.12,12,10),skin);hand.position.y=-.78;armPivot.add(hand);
    armPivot.rotation.z=side*-.14;arms.push(armPivot);
  });

  const legs=[];
  [-1,1].forEach((side,i)=>{
    const legPivot=new THREE.Group();legPivot.position.set(side*.24,.88,0);bodyRoot.add(legPivot);
    const shorts=new THREE.Mesh(new THREE.BoxGeometry(.36,.42,.40),pants);shorts.position.y=-.12;shorts.rotation.z=side*.03;legPivot.add(shorts);
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.145,.46,5,9),skin);leg.position.y=-.50;legPivot.add(leg);
    const sock=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.20,10),white);sock.position.y=-.80;legPivot.add(sock);
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.38,.20,.60),new THREE.MeshStandardMaterial({color:0x5fa7ff,roughness:.75}));shoe.position.set(0,-.94,.14);shoe.castShadow=true;legPivot.add(shoe);
    const toe=new THREE.Mesh(new THREE.BoxGeometry(.22,.12,.20),white);toe.position.set(0,-.91,.36);legPivot.add(toe);
    legs.push(legPivot);
  });

  let pack=null;
  if(withBackpack){
    pack=new THREE.Group();pack.position.set(0,1.50,-.49);bodyRoot.add(pack);
    const shell=new THREE.Mesh(new THREE.BoxGeometry(.84,1.02,.34),new THREE.MeshStandardMaterial({color:0x2f8b52,roughness:.75}));shell.rotation.x=-.06;pack.add(shell);
    const pocket=new THREE.Mesh(new THREE.BoxGeometry(.58,.36,.12),new THREE.MeshStandardMaterial({color:0x24723f,roughness:.8}));pocket.position.set(0,-.22,-.22);pack.add(pocket);
    const star=new THREE.Mesh(new THREE.CircleGeometry(.15,5),new THREE.MeshStandardMaterial({color:0xffd64a,side:THREE.DoubleSide}));star.position.set(0,.14,-.22);star.rotation.y=Math.PI;pack.add(star);
    [-.22,.22].forEach(x=>{const strap=new THREE.Mesh(new THREE.BoxGeometry(.09,.95,.08),new THREE.MeshStandardMaterial({color:0x2a7646,roughness:.8}));strap.position.set(x,0,.27);pack.add(strap)});
    const charm=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),new THREE.MeshStandardMaterial({color:0xff8f6b,roughness:.7}));charm.position.set(.48,-.30,-.12);pack.add(charm);
  }

  g.userData.rig={bodyRoot,headPivot,arms,legs,pack,baseY:0,phase:Math.random()*Math.PI*2};
  g.scale.setScalar(scale);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  return g;
}
const mom=makePerson({shirt:0xf06c78,pants:0x475a86},1.12);mom.position.set(0,0,-8.3);mom.rotation.y=.10;scene.add(mom);const girl=makePerson({shirt:0xf5a3c3,pants:0xf5a3c3},.62,false);girl.position.set(1.15,0,-7.5);girl.rotation.y=-.28;scene.add(girl);const momLabel=labelPlane('👩 媽媽',0,3.95,-8.3,'#fff0f3');momLabel.userData.faceCamera=true;interactables.push({type:'mom',id:'mom',pos:new THREE.Vector3(0,0,-6.6),label:'同媽媽傾偈'});
box(.9,1,.55,0xf5c34c,1.6,.5,-8.15);

const player=makePerson({shirt:0xf6c342,pants:0x2b659d},.94,true);player.position.set(0,0,1.8);scene.add(player);
const playerShadow=new THREE.Mesh(new THREE.CircleGeometry(.52,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.18}));playerShadow.rotation.x=-Math.PI/2;playerShadow.position.y=.02;player.add(playerShadow);

let cameraYaw=0,cameraPitch=.30,cameraDistance=11.5;
camera.position.set(0,7.8,12);camera.lookAt(player.position);
let controlsLocked=true;const keys={};let joy={x:0,y:0};let nearest=null;
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==='e'&&!controlsLocked)doInteract()});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function setupJoystick(){const j=$('joystick'),s=$('stick');let active=false,pid=null;const set=(x,y)=>{const r=j.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=x-cx,dy=y-cy;const max=36,len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max}joy.x=dx/max;joy.y=-dy/max;s.style.transform=`translate(${dx}px,${dy}px)`};const end=()=>{active=false;joy.x=joy.y=0;s.style.transform='translate(0,0)'};j.addEventListener('pointerdown',e=>{active=true;pid=e.pointerId;j.setPointerCapture?.(pid);set(e.clientX,e.clientY)});j.addEventListener('pointermove',e=>{if(active&&e.pointerId===pid)set(e.clientX,e.clientY)});j.addEventListener('pointerup',end);j.addEventListener('pointercancel',end)}
setupJoystick();
function setupCameraControls(){
  const view=renderer.domElement;let active=false,pid=null,lastX=0,lastY=0;
  const start=e=>{
    if(controlsLocked||e.pointerType==='mouse'&&e.button!==0)return;
    active=true;pid=e.pointerId;lastX=e.clientX;lastY=e.clientY;
    view.setPointerCapture?.(pid);e.preventDefault();
  };
  const move=e=>{
    if(!active||e.pointerId!==pid||controlsLocked)return;
    const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
    cameraYaw-=dx*.010;cameraPitch=clamp(cameraPitch-dy*.006,-.08,.72);e.preventDefault();
  };
  const end=e=>{if(e&&pid!==null&&e.pointerId!==pid)return;active=false;pid=null};
  view.addEventListener('pointerdown',start);
  view.addEventListener('pointermove',move);
  view.addEventListener('pointerup',end);
  view.addEventListener('pointercancel',end);
  view.addEventListener('wheel',e=>{cameraDistance=clamp(cameraDistance+Math.sign(e.deltaY)*.8,7.2,16);e.preventDefault()},{passive:false});
  let pinch=0;
  view.addEventListener('touchstart',e=>{if(e.touches.length===2){active=false;pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)}},{passive:true});
  view.addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){const n=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);cameraDistance=clamp(cameraDistance-(n-pinch)*.025,7.2,16);pinch=n;e.preventDefault()}},{passive:false});
  view.addEventListener('touchend',e=>{if(e.touches.length<2)pinch=0},{passive:true});
}
setupCameraControls();
$('interact').onclick=doInteract;
function doInteract(){if(!nearest)return;if(nearest.type==='mom')momInteract();else if(nearest.type==='shop'){if(state.phase!=='shopping'){toast('要先去媽媽度接任務');beep(190,.1)}else openShop(nearest.id)}}
