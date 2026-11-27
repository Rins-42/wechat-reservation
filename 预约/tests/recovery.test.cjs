const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadPage,check,root}=require('../scripts/check.cjs');
function instance(page){page.data=JSON.parse(JSON.stringify(page.data));page.setData=function(update,callback){Object.assign(this.data,update);callback?.();};return page;}
test('all six pages, event handlers, assets, JSON, JS and cloud function references resolve',()=>assert.equal(check().pages,6));
test('all category sentinel displays every item',()=>{
 const page=instance(loadPage('pages/reserve/reserve.js'));
 page.data.items=[{_id:'one',categoryId:'a'},{_id:'two',categoryId:'b'}];
 page.switchCategory({currentTarget:{dataset:{id:'null'}}});
 assert.equal(page.data.currentCategory,null);assert.equal(page.data.filteredItems.length,2);
 page.switchCategory({currentTarget:{dataset:{id:'a'}}});assert.equal(page.data.filteredItems[0]._id,'one');
});
test('catalogue loads multiple pages, resolves category names, and preserves selection',async()=>{
 const rows=Array.from({length:45},(_,i)=>({_id:String(i),categoryId:'c'}));
 const collection=name=>{let offset=0,size=20;return {orderBy(){return this;},skip(n){offset=n;return this;},limit(n){size=n;return this;},async get(){return {data:(name==='items'?rows:[{_id:'c',name:'器材'}]).slice(offset,offset+size)};}};};
 const page=instance(loadPage('pages/reserve/reserve.js',{cloud:{database:()=>({collection})},showToast(){}}));
 page.data.selectedItems=['44'];await page.loadItems();
 assert.equal(page.data.items.length,45);assert.equal(page.data.selectedItemsDetails[0].categoryName,'器材');assert.equal(page.data.items[44].selected,true);
});
test('return button passes the reservation ID to cloud function',async()=>{
 let request;const page=instance(loadPage('pages/return/return.js',{showLoading(){},hideLoading(){},showToast(){},cloud:{async callFunction(args){request=args;return {result:{success:true}};}}}));
 page.loadReservations=async()=>{};await page.returnItems({currentTarget:{dataset:{id:'reservation-1'}}});
 assert.equal(request.data.reservationId,'reservation-1');assert.equal(request.name,'returnReservation');
});
test('failed cancellation never displays success or reloads as if cancelled',async()=>{
 const toasts=[];let reloads=0;const page=instance(loadPage('pages/return/return.js',{showModal:async()=>({confirm:true}),showToast:t=>toasts.push(t),cloud:{callFunction:async()=>({result:{success:false,message:'无权取消'}})}}));
 page.loadReservations=async()=>{reloads++;};await page.cancelReservation({currentTarget:{dataset:{id:'r'}}});
 assert.equal(reloads,0);assert.equal(toasts[0].title,'无权取消');assert.ok(!toasts.some(t=>t.icon==='success'));
});
test('auto-cancellation changes only successfully cancelled rows',async()=>{
 const page=instance(loadPage('pages/return/return.js',{showToast(){},cloud:{callFunction:async args=>({result:{success:args.data.reservationId==='ok'}})}}));
 const rows=[{_id:'ok',status:'approved',endTime:'2020-01-01'},{_id:'failed',status:'approved',endTime:'2020-01-01'}];
 await page.checkAndCancelOverdueReservations(rows);assert.equal(rows[0].status,'cancelled');assert.equal(rows[1].status,'approved');
});
test('user query uses login OPENID instead of a literal placeholder',async()=>{
 let condition;const page=instance(loadPage('pages/userInfo/userInfo.js',{cloud:{database:()=>({collection:()=>({where(q){condition=q;return {get:async()=>({data:[]})};}})})}},{getOpenId:async()=>'real-openid'}));
 await page.loadUserInfo();assert.equal(condition._openid,'real-openid');
});
test('editing an item with no categories completes and keeps selection invalid',async()=>{
 const page=instance(loadPage('pages/admin/content/content.js',{showToast(){},cloud:{database:()=>({collection:()=>({doc:()=>({get:async()=>({data:{categoryId:'removed'}})})})})}}));
 page._categoriesReady=Promise.resolve();await page.loadItem('item');assert.equal(page.data.categoryIndex,-1);
});
test('login requests share one promise and store returned identity',async()=>{
 let app,calls=0;vm.runInNewContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),{App:a=>app=a,wx:{cloud:{callFunction:async()=>{calls++;return {result:{openid:'identity'}};}}},console});
 const ids=await Promise.all([app.getOpenId(),app.getOpenId()]);assert.deepEqual(ids,['identity','identity']);assert.equal(calls,1);assert.equal(app.globalData.openid,'identity');
});
test('submitReservation rejects invalid dates before database access',async()=>{
 const module={exports:{}};const sdk={init(){},database:()=>({command:{}}),getWXContext:()=>({OPENID:'user'})};
 vm.runInNewContext(fs.readFileSync(path.join(root,'cloudfunctions/submitReservation/index.js'),'utf8'),{require:()=>sdk,exports:module.exports,console:{log(){},error(){}}});
 const result=await module.exports.main({items:[{_id:'i'}],startTime:'bad',endTime:'bad',purpose:'test'});assert.equal(result.error,'INVALID_TIME');
});
