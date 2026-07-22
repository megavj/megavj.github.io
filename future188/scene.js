import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const canvas=document.querySelector('#stage');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x050608);scene.fog=new THREE.FogExp2(0x050608,.043);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,100);camera.position.set(0,0,18);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.48,.72,1.02);composer.addPass(bloom);

const root=new THREE.Group();scene.add(root);
const dark=new THREE.MeshPhysicalMaterial({color:0x171a1e,metalness:.95,roughness:.19,clearcoat:1,clearcoatRoughness:.18});
const edge=new THREE.MeshPhysicalMaterial({color:0xb9ff3b,emissive:0x4d7d09,emissiveIntensity:1.1,metalness:.65,roughness:.18});
const black=new THREE.MeshPhysicalMaterial({color:0x08090b,metalness:.8,roughness:.28});

function bar(w,h,x,y,mat=dark,depth=1.35){const g=new RoundedBoxGeometry(w,h,depth,8,.22);const m=new THREE.Mesh(g,mat);m.position.set(x,y,0);m.castShadow=true;m.receiveShadow=true;return m}
const one=new THREE.Group();
one.add(bar(1.18,5.9,.15,-.05),bar(2.35,.78,-.18,-2.88));
const crown=bar(1.9,.92,-.48,2.35,dark);crown.rotation.z=-.48;one.add(crown);
const spine=bar(.08,5.15,.77,-.02,edge,.12);spine.position.z=.74;one.add(spine);
one.position.x=-4.2;root.add(one);
function eight(x){const g=new THREE.Group();for(const y of [1.62,-1.62]){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.62,24,72),dark);ring.scale.y=1.06;ring.position.y=y;g.add(ring);const core=new THREE.Mesh(new THREE.TorusGeometry(1.5,.08,12,72),edge);core.scale.y=1.06;core.position.set(0,y,.68);g.add(core)}g.position.x=x;return g}
const eightA=eight(-.65),eightB=eight(3.25);root.add(eightA,eightB);
const mobile=innerWidth<760;root.rotation.set(-.12,-.32,.02);root.position.set(mobile?3.25:2.2,mobile?-.55:.2,0);if(mobile)root.scale.setScalar(.72);

const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0x050608,metalness:.4,roughness:.55}));floor.rotation.x=-Math.PI/2;floor.position.y=-4.1;scene.add(floor);
const key=new THREE.SpotLight(0xdce8ff,110,60,.32,.7,1.2);key.position.set(-8,10,12);key.target=root;scene.add(key,key.target);
const acid=new THREE.PointLight(0xb9ff3b,42,22,1.5);acid.position.set(6,-1,6);scene.add(acid);
const rim=new THREE.PointLight(0x406bff,22,30,1.4);rim.position.set(-7,1,-5);scene.add(rim);

const count=innerWidth<700?500:1200;const pg=new THREE.BufferGeometry(),pos=new Float32Array(count*3),seed=new Float32Array(count);for(let i=0;i<count;i++){const r=8+Math.random()*15,a=Math.random()*Math.PI*2;pos[i*3]=Math.cos(a)*r;pos[i*3+1]=(Math.random()-.5)*16;pos[i*3+2]=Math.sin(a)*r-5;seed[i]=Math.random()}pg.setAttribute('position',new THREE.BufferAttribute(pos,3));pg.setAttribute('seed',new THREE.BufferAttribute(seed,1));const particles=new THREE.Points(pg,new THREE.PointsMaterial({color:0xb9ff3b,size:.025,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(particles);

const mouse=new THREE.Vector2(),targetMouse=new THREE.Vector2();addEventListener('pointermove',e=>{targetMouse.x=e.clientX/innerWidth*2-1;targetMouse.y=-(e.clientY/innerHeight*2-1)});
let scroll=0,targetScroll=0;function updateScroll(){const max=document.documentElement.scrollHeight-innerHeight;targetScroll=max?scrollY/max:0;document.querySelector('#progress').style.width=(targetScroll*100)+'%'}addEventListener('scroll',updateScroll,{passive:true});updateScroll();
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function mix(a,b,t){return a+(b-a)*t}function clamp01(v){return Math.max(0,Math.min(1,v))}
const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const t=clock.getElapsedTime();mouse.lerp(targetMouse,.045);scroll=mix(scroll,targetScroll,.055);const phase=scroll*4;
  root.rotation.y=-.32+mouse.x*.1+scroll*1.48;root.rotation.x=-.12-mouse.y*.06+Math.sin(t*.35)*.018;root.rotation.z=.02+scroll*.3;
  const startX=mobile?3.25:2.2, startY=mobile?-.55:0;root.position.x=mix(startX,-1.3,clamp01(scroll*1.7));root.position.y=startY+Math.sin(t*.5)*.08+Math.sin(scroll*Math.PI*3)*.45;root.position.z=-scroll*4.5;
  const explode=clamp01((scroll-.38)*3.2);one.position.x=-4.2-explode*5;one.rotation.z=-explode*.45;eightA.position.x=-.65-explode*1.5;eightA.rotation.x=explode*.8;eightB.position.x=3.25+explode*4.5;eightB.rotation.y=-explode*1.1;
  const returnIn=clamp01((scroll-.73)*4),baseScale=mobile?.72:1;root.scale.setScalar(baseScale-explode*.18+returnIn*.42);root.position.x+=returnIn*1.8;root.position.z+=returnIn*3;
  particles.rotation.y=t*.015+scroll*1.5;particles.rotation.z=scroll*.25;acid.position.x=6+Math.sin(t*.7)*2;camera.position.x=mouse.x*.38;camera.position.y=mouse.y*.22;camera.lookAt(0,0,0);
  composer.render();
}
document.body.classList.add('ready');animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7))});
window.__188_READY__=true;
