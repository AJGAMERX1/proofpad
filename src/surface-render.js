// Orthographic camera with equal world units on all three axes.
function surfaceProjection(w, h, view) {
 const c = Math.cos(view.yaw), s = Math.sin(view.yaw);
 const rise = Math.sin(view.pitch), level = Math.cos(view.pitch);
 // Fit the rotating cube's largest projected extents once per viewport.
 // A fixed camera scale keeps orbit from looking like a simultaneous zoom.
 const unit = Math.max(1, Math.min((w - 70) / (2 * Math.SQRT2),
  (h - 54) / (2 * Math.sqrt(3))));
 return {
  scale: 2 * unit / view.span,
  right: [c, -s, 0], up: [-s * rise, -c * rise, level],
  projectVertex(p) {
   const forward=s*p.x+c*p.y;
   p.u=w/2+unit*(c*p.x-s*p.y);
   p.v=h/2+unit*(rise*forward-level*p.z);
   p.depth=level*forward+rise*p.z;
  },
  project(x,y,z) {
   const forward = s*x + c*y;
   return {u: w/2 + unit*(c*x-s*y), v: h/2 + unit*(rise*forward-level*z), depth: level*forward+rise*z};
  }
 };
}

function surfaceHeatGeometry(w,h,view) {
 const left = w < 350 ? 41 : 52, top = 16;
 const width = Math.max(1,w-left-18), height = Math.max(1,h-top-36);
 const size = Math.min(width,height), scale = size/view.span;
 const midX = left+width/2, midY = top+height/2;
 return {left,top,width,height,size,scale,
  x: px => view.cx+(px-midX)/scale, y: py => view.cy+(midY-py)/scale,
  px: x => midX+(x-view.cx)*scale, py: y => midY-(y-view.cy)*scale,
  inside: (px,py) => px>=left && px<=left+width && py>=top && py<=top+height};
}

function surfaceTicks(low,high,target) {
 const rough = (high-low)/Math.max(1,target), base = 10**Math.floor(Math.log10(rough));
 if (!(base>0) || !Number.isFinite(base)) return [];
 const step = ([1,2,5,10].find(k=>k*base>=rough) || 10)*base;
 const first = Math.ceil(low/step-1e-10), result = [];
 for(let i=0;i<=target+2;i++){
  const value = (first+i)*step;
  if(value>high+step*1e-8)break;
  result.push(value);
 }
 return result;
}

function surfaceTickText(number) {
 return Number(number.toPrecision(5)).toString();
}

function surfaceColors(stops) {
 const rgb = color => {
  const value = color.trim().replace(/^#/,'');
  const hex = value.length===3 ? value.split('').map(x=>x+x).join('') : value.slice(0,6);
  return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
 };
 const colors = (stops?.length>=2 ? stops : ['#185c80','#35aab3','#c0df9a','#f9cf76','#db6a59']).map(rgb);
 return Array.from({length:256},(_,i)=>{
  const t=i*(colors.length-1)/255, index=Math.min(colors.length-2,Math.floor(t)), fraction=t-index;
  return colors[index].map((channel,k)=>Math.round(channel*(1-fraction)+colors[index+1][k]*fraction));
 });
}

// Keep appearance validation close to the renderer so saved drafts and exports
// use the same defaults, including drafts from before surface finishes existed.
function surfaceRenderStyle(surface, view) {
 const finish = ['soft', 'gloss', 'flat', 'wire'].includes(surface.finish) ? surface.finish : 'soft';
 const grid = ['auto', 'off', 'fine', 'bold'].includes(surface.grid) ? surface.grid : 'auto';
 const opacity = Number.isFinite(surface.opacity) ? Math.min(1, Math.max(.25, surface.opacity)) : 1;
 const mesh = finish === 'wire' || (grid === 'auto' ? view.mesh : grid !== 'off');
 const gridWidth = grid === 'fine' ? .55 : grid === 'bold' ? 1.35 : .9;
 const baseGridAlpha = grid === 'fine' ? .36 : grid === 'bold' ? .88 : .65;
 const gridAlpha = finish === 'wire' ? Math.max(.72, baseGridAlpha) : baseGridAlpha;
 const gridCount = grid === 'fine' ? 22 : grid === 'bold' ? 12 : finish === 'wire' ? 20 : 15;
 return {finish, grid, opacity, mesh, gridWidth, gridAlpha, gridCount};
}

function surfaceFaceColor(rgb, slopeX, slopeY, finish) {
 if (finish === 'flat' || finish === 'wire') return 'rgb(' + rgb.join(',') + ')';
 const normalLength = Math.hypot(slopeX, slopeY, 1);
 const lighting = (.36 * slopeX + .24 * slopeY + .86) / normalLength;
 if (finish === 'soft') {
  const shade = .88 + .14 * lighting;
  return 'rgb(' + rgb.map(channel => Math.round(Math.min(255, channel * shade))).join(',') + ')';
 }
 // A broad diffuse light and a smaller highlight give the surface a satin
 // sheen. World-space lighting keeps the same appearance when the camera turns.
 const shade = .67 + .34 * Math.max(0, lighting);
 const halfVector = (.18 * slopeX + .12 * slopeY + .976) / normalLength;
 const highlight = .42 * Math.max(0, halfVector) ** 24;
 return 'rgb(' + rgb.map(channel => Math.round(Math.min(255, channel * shade + (255 - channel * shade) * highlight))).join(',') + ')';
}

function paintSurfaceHeat(ctx,w,h,series,view,palette,sampleScale=1,moving=false) {
 let drawn=false;
 const g = surfaceHeatGeometry(w,h,view), bottom=g.top+g.height, right=g.left+g.width;
 const cost = series.reduce((sum,s)=>sum+Math.max(1,s.cost || 1),0);
 if(series.length){
  const area=g.width*g.height;
  const tables=series.map(s=>surfaceColors(s.ramp||palette.ramp));
  const looks=series.map(surface=>surfaceRenderStyle(surface,view));
  const scale=Math.min(3,Math.max(1,sampleScale));
  // A touch can be just a probe. Keep the same heat-map samples while
  // interacting with the view; reserve the fast preview for equation sliders.
  const quick=moving==='slider';
  const pixelBudget=quick?12000:50000, sampleBudget=quick?125000:700000;
  const stride=Math.max(.5,1.5/scale,Math.sqrt(area/pixelBudget)/scale,Math.sqrt(area*cost/sampleBudget)/scale);
  const cols=Math.max(2,Math.ceil(g.width/stride)),rows=Math.max(2,Math.ceil(g.height/stride));
  const bitmap=typeof OffscreenCanvas==='function'?new OffscreenCanvas(cols,rows):ctx.canvas.ownerDocument.createElement('canvas');
  bitmap.width=cols;bitmap.height=rows;
  const ink=bitmap.getContext('2d'), image=ink.createImageData(cols,rows), bytes=image.data;
  const heights=looks.some(look=>look.mesh)?new Float32Array(cols*rows):null;
  const owners=heights?new Int32Array(cols*rows).fill(-1):null;
  const dx=g.width/cols,dy=g.height/rows,half=view.span/2;
  for(let j=0;j<rows;j++){
   const y=g.y(g.top+(j+.5)*dy);
   for(let i=0;i<cols;i++){
    const x=g.x(g.left+(i+.5)*dx),index=j*cols+i;
    let z=-Infinity,topSeries=0;
    for(let n=0;n<series.length;n++){
     const v=series[n].run(x,y);
     if(Number.isFinite(v) && Math.abs(v-view.cz)<=half && v>z){z=v;topSeries=n;}
    }
    if(z===-Infinity){if(heights)heights[index]=NaN;continue;}
    drawn=true;
    const t=(z-view.cz)/view.span+.5, rgb=tables[topSeries][Math.max(0,Math.min(255,Math.round(255*t)))];
    if(heights){heights[index]=t;owners[index]=topSeries;}
    const look=looks[topSeries];
    bytes[4*index]=rgb[0];bytes[4*index+1]=rgb[1];bytes[4*index+2]=rgb[2];
    bytes[4*index+3]=look.finish==='wire'?0:Math.round(255*look.opacity);
   }
  }
  ink.putImageData(image,0,0);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(bitmap,g.left,g.top,g.width,g.height);
  if(heights){
   // Trace constant heights between adjacent samples. A domain hole breaks the contour.
   const contours=series.map(()=>[]);
   const inc=2;
   for(let j=0;j<rows-inc;j+=inc)for(let i=0;i<cols-inc;i+=inc){
    const k=j*cols+i,owner=owners[k];
    if(owner<0 || !looks[owner].mesh || [k+inc,k+inc+inc*cols,k+inc*cols].some(index=>owners[index]!==owner))continue;
    const a=heights[k],b=heights[k+inc],c=heights[k+inc+inc*cols],d=heights[k+inc*cols];
    const lo=Math.min(a,b,c,d),hi=Math.max(a,b,c,d);
    if(!(hi>lo))continue;
    const x=g.left+(i+.5)*dx, y=g.top+(j+.5)*dy, sx=inc*dx,sy=inc*dy;
    for(let level=Math.max(1,Math.ceil(lo*10));level<=Math.min(9,Math.floor(hi*10));level++){
     const t=level/10,points=[];
     function cross(p,q,x1,y1,x2,y2){
      if((p<t)===(q<t))return;
      const f=(t-p)/(q-p);points.push([x1+(x2-x1)*f,y1+(y2-y1)*f]);
     }
     cross(a,b,x,y,x+sx,y);cross(b,c,x+sx,y,x+sx,y+sy);
     cross(c,d,x+sx,y+sy,x,y+sy);cross(d,a,x,y+sy,x,y);
     if(points.length===4 && (((a+b+c+d)/4<t)!==(a<t)))points.unshift(points.pop());
     for(let p=0;p+1<points.length;p+=2)contours[owner].push([points[p],points[p+1]]);
    }
   }
   contours.forEach((segments,index)=>{
    if(!segments.length)return;
    const look=looks[index];
    ctx.beginPath();
    for(const [a,b] of segments){ctx.moveTo(...a);ctx.lineTo(...b);}
    ctx.lineWidth=look.grid==='auto'?.95:look.gridWidth;
    ctx.strokeStyle=look.finish==='wire'?series[index].color:palette.axis;
    ctx.globalAlpha=(look.grid==='auto' && look.finish!=='wire'?.58:look.gridAlpha)*look.opacity;
    ctx.stroke();
   });
   ctx.globalAlpha=1;
  }
 }
 const xt=surfaceTicks(g.x(g.left),g.x(right),Math.max(2,Math.floor(g.width/70)));
 const yt=surfaceTicks(g.y(bottom),g.y(g.top),Math.max(2,Math.floor(g.height/54)));
 ctx.lineWidth=.8;ctx.strokeStyle=palette.axis;ctx.globalAlpha=.22;ctx.beginPath();
 for(const x of xt){const p=g.px(x);ctx.moveTo(p,g.top);ctx.lineTo(p,bottom);}
 for(const y of yt){const p=g.py(y);ctx.moveTo(g.left,p);ctx.lineTo(right,p);}
 ctx.stroke();ctx.globalAlpha=1;ctx.strokeStyle=palette.grid;ctx.strokeRect(g.left,g.top,g.width,g.height);
 ctx.fillStyle=palette.label;ctx.font='11px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
 for(const x of xt){const px=g.px(x);if(px>=g.left+8 && px<right-14)ctx.fillText(surfaceTickText(x),px,bottom+6);}
 ctx.textAlign='right';ctx.textBaseline='middle';
 for(const y of yt){const py=g.py(y);if(py>g.top+10 && py<=bottom)ctx.fillText(surfaceTickText(y),g.left-6,py);}
 ctx.font='italic 15px Georgia,serif';ctx.fillText('x',right,bottom+12);ctx.fillText('y',g.left-8,g.top);
 return drawn;
}

function surfaceGridSize(w,h,series,moving=false,sampleScale=1){
 const exportScale=Math.min(3,Math.max(1,sampleScale));
 if(moving==='slider'){
  const cost=series.reduce((sum,s)=>sum+Math.max(1,s.cost||1),0);
  return Math.max(4,Math.min(36,Math.ceil(Math.min(w,h)/6),
   Math.floor(Math.sqrt(1700/Math.max(1,series.length))),Math.floor(Math.sqrt(120000/Math.max(1,cost)))));
 }
 // Orbiting updates projected coordinates only. A different grid on pointer
 // down or spin would move branch boundaries and clipped surface edges.
 const maxSide=exportScale>1?192:144;
 const target=Math.ceil(Math.min(w,h)*exportScale/3);
 const surfaces=Math.max(1,series.length);
 const cost=series.reduce((sum,s)=>sum+Math.max(1,s.cost||1),0);
 const faceBudget=exportScale>1?42000:24000;
 const sampleBudget=exportScale>1?3200000:1600000;
 return Math.max(4,Math.min(maxSide,target,Math.floor(Math.sqrt(faceBudget/surfaces)),Math.floor(Math.sqrt(sampleBudget/Math.max(1,cost)))));
}

// Camera rotation reprojects the existing vertices. Edits to the expression
// produce a new evaluator; clipping, zoom, mesh, and palette changes rebuild it.
const preparedSurfaces=new WeakMap();
function prepareSurfaceMesh(surface,view,count,ramp){
 const look=surfaceRenderStyle(surface,view);
 const key=[count,view.cx,view.cy,view.cz,view.span,look.finish,look.grid,look.opacity,look.mesh,surface.color,...(ramp||[])].join('|');
 const previous=preparedSurfaces.get(surface.run);
 if(previous?.key===key)return previous;
 const vertices=[],faces=[],half=view.span/2,step=2/count;
 const meshInterval=Math.max(1,Math.round(count/look.gridCount)),lut=surfaceColors(ramp);
 function cutAt(points,z,keepAbove){
  const inside=p=>keepAbove?p.z>=z:p.z<=z, next=[];
  let a=points.at(-1);
  for(const b of points){
   if(inside(a)!==inside(b)){
    const t=(z-a.z)/(b.z-a.z);
    next.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y),z,clipped:true});
   }
   if(inside(b))next.push(b);
   a=b;
  }
  return next;
 }
 function sample(x,y){return (surface.run(view.cx+x*half,view.cy+y*half)-view.cz)/half;}
 // On either side of a pole the sampled heights move away from the halfway
 // value as the interval narrows. A continuous crossing converges toward it.
 function jumpsAcrossPole(p,q){
  let a=p,b=q;
  const midTarget=(p.z+q.z)/2;
  const gap=Math.abs(b.z-a.z);
  if(gap<=1e-12)return false;
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  mid.z=sample(mid.x,mid.y);
  if(!Number.isFinite(mid.z))return true;
  if(mid.z>=Math.min(a.z,b.z)&&mid.z<=Math.max(a.z,b.z))return false;
  let probe=mid;
  for(let k=0;k<5;k++){
   if((a.z<midTarget)===(probe.z<midTarget))a=probe;
   else b=probe;
   probe={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   probe.z=sample(probe.x,probe.y);
   if(!Number.isFinite(probe.z))return true;
  }
  return Math.abs(a.z-b.z)>gap*2;
 }
 for(let j=0;j<=count;j++)for(let i=0;i<=count;i++){
  const x=-1+i*step,y=-1+j*step;vertices.push({x,y,z:sample(x,y)});
 }
 // A small multiple of tan(x) or 1/x can jump across a pole even when the
 // difference in height is less than one pixel. A reversed secant compared
 // with its neighbors identifies edges to check at their actual world scale.
 const cuts=new Uint8Array(vertices.length),rowSize=count+1;
 function testEdge(k,offset,index){
  const a=vertices[k],b=vertices[k+offset],change=b.z-a.z;
  if(!Number.isFinite(change)||Math.abs(change)<=1e-12)return false;
  const previous=index>0?vertices[k-offset].z:a.z;
  const next=index<count-1?vertices[k+2*offset].z:b.z;
  return ((a.z-previous)*change<0 || (next-b.z)*change<0) && jumpsAcrossPole(a,b);
 }
 for(let j=0;j<=count;j++)for(let i=0;i<=count;i++){
  const k=j*rowSize+i;
  if(i<count && testEdge(k,1,i))cuts[k]|=1;
  if(j<count && testEdge(k,rowSize,j))cuts[k]|=2;
 }
 for(let j=0;j<count;j++)for(let i=0;i<count;i++){
  const k=j*(count+1)+i,a=vertices[k],b=vertices[k+1],c=vertices[k+count+2],d=vertices[k+count+1];
  if(cuts[k] || (cuts[k+1]&2) || (cuts[k+rowSize]&1))continue;
  const low=Math.min(a.z,b.z,c.z,d.z), high=Math.max(a.z,b.z,c.z,d.z);
  if(!Number.isFinite(low)||!Number.isFinite(high)||low>1||high< -1)continue;
  const center=sample(a.x+step/2,a.y+step/2);
  if(!Number.isFinite(center))continue;
  let poly=[a,b,c,d];
  if(high-low>.30){
   // A pole can have four finite corners on opposite branches. Check steep
   // edges and the cell center before connecting them or clipping the face.
   const mean=(a.z+b.z+c.z+d.z)/4;
   if(Math.abs(center-mean)>Math.max(.12,.24*(high-low)))continue;
   if(poly.some((p,k)=>{
    const q=poly[(k+1)%4],jump=Math.abs(q.z-p.z);
    if(jump<.30)return false;
    const mid=sample((p.x+q.x)/2,(p.y+q.y)/2);
    return !Number.isFinite(mid)||Math.abs(mid-(p.z+q.z)/2)>Math.max(.12,.24*jump);
   }))continue;
  }
  if(low< -1)poly=cutAt(poly,-1,true);
  if(high>1 && poly.length)poly=cutAt(poly,1,false);
  if(poly.length<3)continue;
  for(const point of poly)if(point.clipped)vertices.push(point);
  const z=poly.reduce((sum,p)=>sum+p.z,0)/poly.length;
  const rgb=lut[Math.max(0,Math.min(255,Math.round((z+1)*127.5)))];
  const dzx=((b.z-a.z)+(c.z-d.z))/(2*step),dzy=((d.z-a.z)+(c.z-b.z))/(2*step);
  const color=surfaceFaceColor(rgb,dzx,dzy,look.finish);
  const mesh=[];
  if(look.mesh){
   for(let e=0;e<poly.length;e++){
    const p=poly[e],q=poly[(e+1)%poly.length];
    const onSlice=Math.abs(p.z)===1&&p.z===q.z;
    if((p.x===q.x && (i%meshInterval===0&&p.x===a.x || p.x===1))||
       (p.y===q.y && (j%meshInterval===0&&p.y===a.y || p.y===1))||onSlice)mesh.push([p,q]);
   }
  }
  faces.push({points:poly,color,mesh,wire:look.finish==='wire'?color:surface.color,
   filled:look.finish!=='wire',opacity:look.opacity,gridWidth:look.gridWidth,gridAlpha:look.gridAlpha,depth:0});
 }
 const geometry={key,vertices,faces};
 preparedSurfaces.set(surface.run,geometry);
 return geometry;
}

// Coordinates for faces are normalized around the view center in [-1,1]³.
function paintSurfacePlot(ctx,w,h,series,view,palette,moving=false,sampleScale=1) {
 if(!(w>0 && h>0 && view.span>0))return;
 ctx.save();
 try{
  ctx.fillStyle=palette.paper;ctx.fillRect(0,0,w,h);
  if(view.heatmap)return paintSurfaceHeat(ctx,w,h,series,view,palette,sampleScale,moving);
  const camera=surfaceProjection(w,h,view), project=camera.project, half=view.span/2;
  const floor=Math.sin(view.pitch)>=0?-1:1;
  const nearX=Math.sin(view.yaw)>=0?1:-1, nearY=Math.cos(view.yaw)>=0?1:-1;
  const leftX=Math.cos(view.yaw)>=0?-1:1, leftY=Math.sin(view.yaw)>=0?1:-1;
  const ticks=[view.cx,view.cy,view.cz].map(n=>surfaceTicks(n-half,n+half,5).map(v=>({value:v,t:(v-n)/half})));
  function line(a,b){
   const p=project(...a),q=project(...b);ctx.moveTo(p.u,p.v);ctx.lineTo(q.u,q.v);
  }
  ctx.beginPath();ctx.strokeStyle=palette.grid;ctx.lineWidth=.9;
  for(const {t} of ticks[0])line([t,-1,floor],[t,1,floor]);
  for(const {t} of ticks[1])line([-1,t,floor],[1,t,floor]);
  line([-1,-nearY,floor],[1,-nearY,floor]);line([-nearX,-1,floor],[-nearX,1,floor]);ctx.stroke();
  ctx.beginPath();ctx.strokeStyle=palette.axis;ctx.globalAlpha=.44;
  const origin=[-view.cx/half,-view.cy/half,-view.cz/half];
  // Draw the true coordinate axes when the visible volume intersects them.
  for(let axis=0;axis<3;axis++){
   if(origin.some((p,i)=>i!==axis&&Math.abs(p)>1))continue;
   const a=origin.slice(),b=origin.slice();a[axis]=-1;b[axis]=1;line(a,b);
  }
  ctx.stroke();ctx.globalAlpha=1;
  const count=surfaceGridSize(w,h,series,moving,sampleScale),faces=[];
  for(const surface of series){
   const ramp=surface.ramp||palette.ramp;
   const geometry=prepareSurfaceMesh(surface,view,count,ramp);
   for(const vertex of geometry.vertices)camera.projectVertex(vertex);
   for(const face of geometry.faces){
    let depth=0;
    for(const p of face.points)depth+=p.depth;
    face.depth=depth/face.points.length;
    faces.push(face);
   }
  }
  // A common depth order allows surfaces on different expression rows to intersect.
  faces.sort((a,b)=>a.depth-b.depth);
  ctx.lineJoin='round';
  for(const face of faces){
   const p=face.points;ctx.beginPath();ctx.moveTo(p[0].u,p[0].v);
   for(let i=1;i<p.length;i++)ctx.lineTo(p[i].u,p[i].v);
   ctx.closePath();ctx.fillStyle=ctx.strokeStyle=face.color;
   if(face.filled){
    ctx.globalAlpha=.95*face.opacity;ctx.fill();ctx.lineWidth=.56;ctx.stroke();
   }
   if(face.mesh.length){
    ctx.beginPath();for(const [a,b] of face.mesh){ctx.moveTo(a.u,a.v);ctx.lineTo(b.u,b.v);}
    ctx.strokeStyle=face.wire;ctx.lineWidth=face.gridWidth;ctx.globalAlpha=face.gridAlpha*face.opacity;ctx.stroke();
   }
  }
  ctx.globalAlpha=1;
  const occupied=[];
  function label(text,x,y,axis=false){
   const width=ctx.measureText(text).width, height=axis?16:12;
   x=Math.max(width/2+2,Math.min(w-width/2-2,x));y=Math.max(height/2+2,Math.min(h-height/2-2,y));
   if(!axis && occupied.some(box=>Math.abs(x-box.x)<(width+box.width)/2+4&&Math.abs(y-box.y)<(height+box.height)/2+1))return;
   occupied.push({x,y,width,height});
   ctx.strokeStyle=palette.paper;ctx.lineWidth=3.2;ctx.strokeText(text,x,y);
   ctx.fillStyle=palette.label;ctx.fillText(text,x,y);
  }
  const axes=[
   {name:'x',point:t=>[t,nearY,floor]}, {name:'y',point:t=>[nearX,t,floor]},
   {name:'z',point:t=>[leftX,leftY,t]}
  ];
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineCap='round';
  for(const axis of axes){
   const a=project(...axis.point(-1)), b=project(...axis.point(1)),dx=b.u-a.u,dy=b.v-a.v;
   const len=Math.hypot(dx,dy), sign=(dy*((a.u+b.u)/2-w/2)-dx*((a.v+b.v)/2-h/2))>0?1:-1;
   axis.nx=sign*dy/(len||1);axis.ny=-sign*dx/(len||1);axis.len=len;
   ctx.beginPath();ctx.moveTo(a.u,a.v);ctx.lineTo(b.u,b.v);ctx.lineWidth=1.05;ctx.strokeStyle=palette.axis;ctx.stroke();
   if(len>=14){
    const p=project(...axis.point(axis.name==='z'?.93:.05));
    ctx.font='italic bold 15px Georgia,serif';label(axis.name,p.u+axis.nx*22,p.v+axis.ny*22,true);
   }
  }
  ctx.font='10px system-ui,sans-serif';
  for(const [k,axis] of axes.entries()){
   if(axis.len<34)continue;
   for(const tick of ticks[k]){
    const p=project(...axis.point(tick.t));ctx.beginPath();ctx.moveTo(p.u,p.v);
    ctx.lineTo(p.u+axis.nx*3,p.v+axis.ny*3);ctx.lineWidth=.8;ctx.strokeStyle=palette.axis;ctx.stroke();
    label(surfaceTickText(tick.value),p.u+axis.nx*10,p.v+axis.ny*10);
   }
  }
  return faces.length>0;
 }finally{ctx.restore();}
}
