function animateCharacter(char,t,moving=false,speed=1){
  const rig=char.userData.rig;if(!rig)return;
  const phase=rig.phase;
  if(moving){
    const swing=Math.sin(t*10*speed+phase);
    rig.arms[0].rotation.x=swing*.72;rig.arms[1].rotation.x=-swing*.72;
    rig.legs[0].rotation.x=-swing*.64;rig.legs[1].rotation.x=swing*.64;
    rig.bodyRoot.position.y=Math.abs(Math.sin(t*10*speed+phase))*.075;
    rig.bodyRoot.rotation.z=Math.sin(t*10*speed+phase)*.025;
    rig.headPivot.rotation.y=Math.sin(t*4+phase)*.035;
    if(rig.pack)rig.pack.rotation.z=Math.sin(t*10*speed+phase)*.04;
  }else{
    const breathe=Math.sin(t*2.1+phase);
    rig.arms[0].rotation.x=.04+breathe*.025;rig.arms[1].rotation.x=-.04-breathe*.025;
    rig.legs[0].rotation.x=0;rig.legs[1].rotation.x=0;
    rig.bodyRoot.position.y=breathe*.018;
    rig.bodyRoot.rotation.z=Math.sin(t*.9+phase)*.012;
    rig.headPivot.rotation.y=Math.sin(t*.7+phase)*.055;
    rig.headPivot.rotation.z=Math.sin(t*.55+phase)*.018;
    if(rig.pack)rig.pack.rotation.z=Math.sin(t*1.1+phase)*.012;
  }
}

const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);const now=performance.now()*.001;
  let playerMoving=false;
  if(!controlsLocked){
    const inputX=(keys['d']||keys['arrowright']?1:0)-(keys['a']||keys['arrowleft']?1:0)+joy.x;
    const inputF=(keys['w']||keys['arrowup']?1:0)-(keys['s']||keys['arrowdown']?1:0)+joy.y;
    const len=Math.hypot(inputX,inputF);
    if(len>.08){
      playerMoving=true;
      const ix=inputX/Math.max(1,len),inf=inputF/Math.max(1,len);
      const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()<0.0001)forward.set(0,0,-1);forward.normalize();
      const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
      const move=right.multiplyScalar(ix).add(forward.multiplyScalar(inf));const speed=6.4;
      player.position.x=clamp(player.position.x+move.x*speed*dt,-27,27);player.position.z=clamp(player.position.z+move.z*speed*dt,-27,27);
      const targetRot=Math.atan2(move.x,move.z);let diff=((targetRot-player.rotation.y+Math.PI)%(Math.PI*2))-Math.PI;player.rotation.y+=diff*Math.min(1,dt*11);
    }
  }
  animateCharacter(player,now,playerMoving,1);
  animateCharacter(mom,now,false,.72);
  animateCharacter(girl,now,false,.9);

  const horizontal=cameraDistance*Math.cos(cameraPitch),height=2.0+cameraDistance*Math.sin(cameraPitch);
  const desired=new THREE.Vector3(player.position.x+Math.sin(cameraYaw)*horizontal,player.position.y+height,player.position.z+Math.cos(cameraYaw)*horizontal);camera.position.lerp(desired,.10);camera.lookAt(player.position.x,player.position.y+1.25,player.position.z);

  nearest=null;let best=2.8;for(const it of interactables){const d=player.position.distanceTo(it.pos);if(d<best){best=d;nearest=it}}
  const ib=$('interact');if(nearest&&!controlsLocked){ib.style.display='flex';ib.textContent=nearest.label}else ib.style.display='none';

  scene.traverse(o=>{
    if(o.userData.faceCamera)o.quaternion.copy(camera.quaternion);
    if(o.userData.balloonBase!==undefined){o.position.y=o.userData.balloonBase+Math.sin(now*1.6+o.position.x)*.10;o.rotation.z=Math.sin(now*1.25+o.position.x)*.035}
    if(o.userData.shopLabel){o.position.y=o.userData.baseY+Math.sin(now*1.4+o.userData.phase)*.08;o.scale.setScalar(1+Math.sin(now*1.4+o.userData.phase)*.012)}
    if(o.userData.fountainMain){o.scale.y=.92+Math.sin(now*3.4)*.08;o.material.opacity=.66+Math.sin(now*3.4)*.08}
    if(o.userData.fountainSide){o.scale.y=.88+Math.sin(now*3.8+o.userData.phase)*.12;o.material.opacity=.54+Math.sin(now*3.8+o.userData.phase)*.09}
  });

  animatedClouds.forEach(c=>{c.position.x+=c.userData.speed*dt;if(c.position.x>38)c.position.x=-38;c.position.y+=Math.sin(now*.25+c.userData.startX)*.0015});
  butterflies.forEach((b,i)=>{const ph=now*1.6+b.userData.phase;b.position.x=b.userData.origin.x+Math.sin(ph)*1.0;b.position.z=b.userData.origin.z+Math.cos(ph*.8)*.75;b.position.y=b.userData.origin.y+.18+Math.sin(ph*2.1)*.16;b.rotation.y=Math.atan2(Math.cos(ph),-Math.sin(ph));const flap=Math.sin(now*16+i);b.userData.wings[0].rotation.y=.42+flap*.58;b.userData.wings[1].rotation.y=-.42-flap*.58});
  birds.forEach((b,i)=>{const a=now*.12+b.userData.phase;b.position.x=Math.cos(a)*b.userData.radius;b.position.z=-18+Math.sin(a)*b.userData.radius*.42;b.position.y=13+i*1.4+Math.sin(a*2)*.5;b.rotation.y=-a+Math.PI/2;const flap=Math.sin(now*8+i);b.userData.wings[0].rotation.z=.15+flap*.42;b.userData.wings[1].rotation.z=-.15-flap*.42});

  renderer.render(scene,camera)
}
animate();

$('startBtn').onclick=()=>{state.started=true;close('startOverlay');controlsLocked=false;toast('左邊搖桿移動；在3D畫面任何位置拖動即可旋轉視角',3200);speak('歡迎來到香港公園購物冒險。請用左邊搖桿行去搵媽媽。你可以直接在三D畫面任何位置拖動，旋轉視角。');beep(640,.1)};
$('soundBtn').onclick=()=>{state.sound=!state.sound;$('soundBtn').textContent=state.sound?'🔊 聲效：開':'🔇 聲效：關';if(state.sound)beep(600,.06)};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
addEventListener('touchmove',e=>{if(e.target.closest('#joystick,#wallet,#tray'))e.preventDefault()},{passive:false});
updateHud();
