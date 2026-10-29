// Independent physical invariants; run with node tests/check-model.cjs.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');
const node={textContent:'',innerHTML:'',setAttribute(){},classList:{toggle(){}},value:0};
const c=vm.createContext({console,Math,document:{querySelector:()=>node,querySelectorAll:()=>[]},matchMedia:()=>({matches:false}),window:{},THREE:require('../vendor/three.min.js')});
for(const f of ['core.js','courses.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',f),'utf8'),c);
const run=s=>vm.runInContext(s,c);
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
// Derive the field from three winding axes, rather than the animation's angle formula.
for(let sector=0;sector<6;sector++){
  const r=run(`state.motor='bldc';state.theta=${(sector+.3)*Math.PI/3};({i:currents(state.theta),a:phaseAngle()})`);
  near(r.i.reduce((a,b)=>a+b,0),0);assert.equal(r.i.filter(v=>v===0).length,1);
  let x=0,y=0;r.i.forEach((v,i)=>{x+=v*Math.cos(i*2*Math.PI/3);y+=v*Math.sin(i*2*Math.PI/3)});
  near(Math.sin(Math.atan2(y,x)-r.a),0);assert.ok(Math.cos(Math.atan2(y,x)-r.a)>.999);
}
for(let i=0;i<72;i++){
  const t=i*Math.PI/36,r=run(`state.motor='pmsm';currents(${t})`);
  near(r.reduce((a,b)=>a+b,0),0);let x=0,y=0;r.forEach((v,k)=>{x+=v*Math.cos(k*2*Math.PI/3);y+=v*Math.sin(k*2*Math.PI/3)});
  near(Math.hypot(x,y),1.5);near(Math.sin(Math.atan2(y,x)-t),0);
}
for(const motor of ['induction','capacitor','shaded'])for(const load of [0,40,100]){const r=run(`state.motor='${motor}';state.load=${load};values()`);assert.ok(r.nr>0&&r.nr<r.ns);near((r.ns-r.nr)/r.ns,r.s);}
for(let i=0;i<72;i++){const r=run(`state.motor='brushed';state.rot=${i*Math.PI/36};currents(0)[0]`);assert.ok(r*Math.cos(i*Math.PI/36)>=-1e-9,'Brushed torque must not reverse across commutation.');}
// Verify the actual annular-sector geometry puts the red N hemisphere on the +y magnetic axis.
const geometry=run(`(() => {const e=Object.create(MotorScene.prototype);e.geoCache=new Map();e.materials={red:new THREE.MeshStandardMaterial()};const g=new THREE.Group();const m=e.ring(.76,.89,1.58,'red',g,[0,0,0],-Math.PI/2+.02,Math.PI-.04);const p=m.geometry.attributes.position;let y=0,z=0;for(let i=0;i<p.count;i++){y+=p.getY(i);z+=p.getZ(i)}return {y:y/p.count,z:z/p.count}})()`);
assert.ok(geometry.y>.4);near(geometry.z,0,1e-6);
const lessons=run('Object.values(courses).map(c=>c.length)');assert.equal(lessons.length,6);assert.ok(lessons.every(n=>n===8));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(!/<script[^>]+src=|<link[^>]+rel=["']stylesheet/i.test(html),'Offline delivery must not need external scripts or styles.');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);const duplicate=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
// Runtime-generated HTML templates are in scripts; check only static document IDs.
const staticIds=[...html.split('<script>')[0].matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(staticIds).size,staticIds.length);
console.log('PASS: 6 BLDC vectors, 72 sinusoidal field states, 9 induction operating points, 72 brush torque signs, N-pole geometry, 48 lessons, offline packaging, unique static IDs.');
