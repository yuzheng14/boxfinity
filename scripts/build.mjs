import { cp, rm } from 'node:fs/promises';
import { prepareVendor } from './vendor.mjs';
await prepareVendor();
const output=new URL('../dist/',import.meta.url);
await rm(output,{recursive:true,force:true});
await cp(new URL('../web/',import.meta.url),output,{recursive:true});
console.log('Static site ready: dist/');
