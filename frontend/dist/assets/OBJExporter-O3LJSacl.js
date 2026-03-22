import{D as e,O as t,a as n,i as r,k as i,m as a,t as o,w as s}from"./index-BV9WLm4p.js";var c;i((()=>{o(),c=class{parse(i){let o=``,c=0,l=0,u=0,d=new t,f=new r,p=new t,m=new e,h=[];function g(e){let t=0,n=0,r=0,i=e.geometry,s=new a,f=i.getAttribute(`position`),g=i.getAttribute(`normal`),_=i.getAttribute(`uv`),v=i.getIndex();if(o+=`o `+e.name+`
`,e.material&&e.material.name&&(o+=`usemtl `+e.material.name+`
`),f!==void 0)for(let n=0,r=f.count;n<r;n++,t++)d.fromBufferAttribute(f,n),d.applyMatrix4(e.matrixWorld),o+=`v `+d.x+` `+d.y+` `+d.z+`
`;if(_!==void 0)for(let e=0,t=_.count;e<t;e++,r++)m.fromBufferAttribute(_,e),o+=`vt `+m.x+` `+m.y+`
`;if(g!==void 0){s.getNormalMatrix(e.matrixWorld);for(let e=0,t=g.count;e<t;e++,n++)p.fromBufferAttribute(g,e),p.applyMatrix3(s).normalize(),o+=`vn `+p.x+` `+p.y+` `+p.z+`
`}if(v!==null)for(let e=0,t=v.count;e<t;e+=3){for(let t=0;t<3;t++){let n=v.getX(e+t)+1;h[t]=c+n+(g||_?`/`+(_?l+n:``)+(g?`/`+(u+n):``):``)}o+=`f `+h.join(` `)+`
`}else for(let e=0,t=f.count;e<t;e+=3){for(let t=0;t<3;t++){let n=e+t+1;h[t]=c+n+(g||_?`/`+(_?l+n:``)+(g?`/`+(u+n):``):``)}o+=`f `+h.join(` `)+`
`}c+=t,l+=r,u+=n}function _(e){let t=0,n=e.geometry,r=e.type,i=n.getAttribute(`position`);if(o+=`o `+e.name+`
`,i!==void 0)for(let n=0,r=i.count;n<r;n++,t++)d.fromBufferAttribute(i,n),d.applyMatrix4(e.matrixWorld),o+=`v `+d.x+` `+d.y+` `+d.z+`
`;if(r===`Line`){o+=`l `;for(let e=1,t=i.count;e<=t;e++)o+=c+e+` `;o+=`
`}if(r===`LineSegments`)for(let e=1,t=e+1,n=i.count;e<n;e+=2,t=e+1)o+=`l `+(c+e)+` `+(c+t)+`
`;c+=t}function v(e){let t=0,r=e.geometry,i=r.getAttribute(`position`),a=r.getAttribute(`color`);if(o+=`o `+e.name+`
`,i!==void 0){for(let r=0,c=i.count;r<c;r++,t++)d.fromBufferAttribute(i,r),d.applyMatrix4(e.matrixWorld),o+=`v `+d.x+` `+d.y+` `+d.z,a!==void 0&&(f.fromBufferAttribute(a,r),n.workingToColorSpace(f,s),o+=` `+f.r+` `+f.g+` `+f.b),o+=`
`;o+=`p `;for(let e=1,t=i.count;e<=t;e++)o+=c+e+` `;o+=`
`}c+=t}return i.traverse(function(e){e.isMesh===!0&&g(e),e.isLine===!0&&_(e),e.isPoints===!0&&v(e)}),o}}}))();export{c as OBJExporter};