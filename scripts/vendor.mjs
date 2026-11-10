import { copyFile, mkdir } from 'node:fs/promises';

// Copy only the approved runtime files; no CDN, bundler, or extra packages.
export async function prepareVendor(){
  const source=new URL('../node_modules/three/',import.meta.url);
  const target=new URL('../web/vendor/three/',import.meta.url);
  await mkdir(target,{recursive:true});
  for(const [from,to] of [
    ['build/three.module.js','three.module.js'],
    ['build/three.core.js','three.core.js'],
    ['examples/jsm/controls/OrbitControls.js','OrbitControls.js'],
    ['LICENSE','LICENSE'],
  ])await copyFile(new URL(from,source),new URL(to,target));
}
