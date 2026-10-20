const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const repo = process.env.SOT_TEST_REPO || path.resolve(__dirname,'..');
const source = n => fs.readFileSync(path.join(repo,n),'utf8');
function store(initial={}) { const m=new Map(Object.entries(initial));return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}; }
function harness() {
 let now=10000000;
 const events={};
 const c={Date:{now:()=>now},JSON,Number,String,Error,localStorage:store(),sessionStorage:store(),window:{location:{href:'/mypage',pathname:'/mypage',reload(){}},addEventListener:(n,f)=>events[n]=f}};
 vm.createContext(c);vm.runInContext(source('00_Auth.js'),c);
 return {c,auth:c.window.ShoutAuth,advance:n=>now+=n,events};
}
function login(h,id='user-a',token='token-a',expires=7200) {return h.auth.save({users_id:id,access_token:token,is_admin:true},{access_token:token,expires_in:expires,issued_at:h.c.Date.now()});}
test('complete login is stored together and hydrates token in a second tab',()=>{
 const h=harness();login(h);const r=JSON.parse(h.c.localStorage.getItem('shout_auth'));
 assert.equal(r.user_id,'user-a');assert.equal(r.expires_at-r.issued_at,7200000);
 h.c.sessionStorage.removeItem('shout_access_token');assert.equal(h.auth.getAccessToken(),'token-a');
 assert.equal(h.c.sessionStorage.getItem('shout_access_token'),'token-a');
});
test('incomplete or mismatched login cannot replace the prior account',()=>{
 const h=harness();login(h);const before=h.c.localStorage.getItem('shout_auth');
 for(const payload of [{users_id:'other'},{access_token:'token-b'},{users_id:'other',access_token:'wrong'}]) {
  assert.throws(()=>h.auth.save(payload,{access_token:'token-b',issued_at:h.c.Date.now()}));
  assert.equal(h.c.localStorage.getItem('shout_auth'),before);assert.equal(h.auth.getUserId(),'user-a');
 }
});
test('account change replaces all aliases, including omitted optional fields',()=>{
 const h=harness();login(h);h.auth.save({users_id:'user-b',access_token:'token-b'},{access_token:'token-b',issued_at:h.c.Date.now()});
 assert.equal(h.auth.getUserId(),'user-b');assert.equal(h.auth.getAccessToken(),'token-b');
 assert.equal(h.c.localStorage.getItem('shout_is_admin'),'false');assert.equal(h.c.localStorage.getItem('shout_kakao_id'),'');
});
test('token expires at two hours while payment identity survives',()=>{
 const h=harness();login(h);h.advance(7199999);assert.equal(h.auth.getAccessToken(),'token-a');
 h.advance(1);assert.equal(h.auth.getAccessToken(),'');assert.equal(h.auth.getUserId(),'user-a');
 assert.equal(h.c.sessionStorage.getItem('shout_access_token'),null);
});
test('SDK shorter expiry is honored and longer expiry cannot extend two hours',()=>{
 for(const [seconds,ms] of [[30,30000],[999999,7200000]]) {const h=harness();const r=login(h,'user-a','token-a',seconds);assert.equal(r.expires_at-r.issued_at,ms);}
});
test('unknown legacy expiry requires protected re-login, but ID-only payment remains available',()=>{
 const h=harness();h.c.localStorage.setItem('shout_users_id','legacy');h.c.sessionStorage.setItem('shout_access_token','legacy-token');
 assert.equal(h.auth.getAccessToken(),'');assert.equal(h.auth.getUserId(),'legacy');
});
test('logout removes credentials and return state while preserving browser cart',()=>{
 const h=harness();login(h);h.c.localStorage.setItem('shout_cart_data','cart');h.c.sessionStorage.setItem('shout_auth_intent','{}');
 h.auth.logout();assert.equal(h.auth.getUserId(),'');assert.equal(h.auth.getAccessToken(),'');
 assert.equal(h.c.localStorage.getItem('shout_cart_data'),'cart');assert.equal(h.c.sessionStorage.getItem('shout_auth_intent'),null);
 assert.equal(h.c.window.location.href,'/');
});
test('admin requests after expiry redirect to login before sending a request',()=>{
 const h=harness();login(h);assert.equal(h.auth.getAdminToken(),'token-a');h.advance(7200000);
 assert.throws(()=>h.auth.getAdminToken(),/ADMIN_AUTH_REQUIRED/);assert.equal(h.c.window.location.href,'/login');
 assert.equal(JSON.parse(h.c.sessionStorage.getItem('shout_auth_intent')).after,'admin');
});
test('temporary server errors are distinct from explicit token rejection',()=>{
 const h=harness();assert.equal(h.auth.isAuthFailure(503,{message:'unavailable'}),false);
 assert.equal(h.auth.isAuthFailure(400,{code:-401}),true);assert.equal(h.auth.isAuthFailure(401,{}),true);
});
function part(s,a,b) {const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);}
test('orders and confirmation send no Kakao token',()=>{
 for(const n of ['03_Cart-v1-260616-2.js','03_Cart-m-checkout.runtime.js','Payment-success-B.runtime.js']) assert.doesNotMatch(source(n),/shout_access_token|["']access_token["']\s*[:,]/);
});
test('paid return uses the initiating checkout account even if browser login changed',()=>{
 const s=source('Payment-success-B.runtime.js');assert.match(s,/if \(String\(checkoutContextAtEntry.order_id \|\| ""\).trim\(\) === orderId\) \{\s*usersId = String\(checkoutContextAtEntry.users_id \|\| usersId/);
 assert.match(s,/if \(!usersId\)/);assert.doesNotMatch(s,/!accessToken/);
});
test('purchase and file requests retain tokens and use fresh credentials',async()=>{
 const s=source('04_MyPage-B.runtime.js');const h=harness();login(h);
 const sent=[];Object.assign(h.c,{WF_GET_PURCHASES:'purchases',WF_SIGNED_URL:'master',WF_SIGNED_STANDARD_URL:'standard',fetch:async(url,options)=>{sent.push([url,JSON.parse(options.body)]);return {ok:true,status:200,json:async()=>({response:{}})};}});
 vm.runInContext(part(s,'  function requireMyPageLogin()', '  function waitForEventMap'),h.c);
 for(const url of ['purchases','master','standard']) await h.c.postJson(url,{access_token:'stale',users_id:'old',fileName:'file'});
 for(const [url,body] of sent) {assert.equal(body.users_id,'user-a');assert.equal(body.access_token,'token-a');}
 h.advance(7200000);await assert.rejects(h.c.postJson('master',{}),/AUTH_REQUIRED/);assert.equal(sent.length,3);
});
test('transient purchase error preserves credentials and does not redirect',async()=>{
 const s=source('04_MyPage-B.runtime.js'),h=harness();login(h);
 Object.assign(h.c,{WF_GET_PURCHASES:'p',WF_SIGNED_URL:'m',WF_SIGNED_STANDARD_URL:'s',fetch:async()=>({ok:false,status:503,json:async()=>({message:'unavailable'})})});
 vm.runInContext(part(s,'  function requireMyPageLogin()', '  function waitForEventMap'),h.c);
 await assert.rejects(h.c.postJson('p',{}));assert.equal(h.auth.getAccessToken(),'token-a');assert.equal(h.c.window.location.href,'/mypage');
});
test('ZIP request function and handler remain unchanged',()=>{
 const crypto=require('node:crypto');
 const unchanged=part(source('04_MyPage-B.runtime.js'),'  async function requestZipSignedUrl(','  (async () => {');
 assert.equal(crypto.createHash('sha256').update(unchanged).digest('hex'),'c2d0a0e1751cc3a7c3d52623e7d089c2d1731da1ce993ece1e903d876c28932d');
});
test('PC error exits modal and mobile always offers a cart exit',()=>{
 const cart=source('03_Cart-v1-260616-2.js'),mobile=source('03_Cart-m-checkout.runtime.js');
 assert.match(cart,/warn\("silent catch: createOrder.parseResponse", e\);\s*closePaymentModal\(\)/);
 assert.match(mobile,/<a href="\/cart" class="sh-checkout-back-btn">/);
 assert.match(part(mobile,'    } catch (err) {\n      console.error("[checkout.startPayment]', '  function bindEvents()'),/renderErrorState/);
});
test('admin page watches token expiry without renewing the expiry timestamp',()=>{
 const s=source('06_Admin-B.js');assert.match(s,/setTimeout\(check, Math.max\(0, auth.expires_at - Date.now\(\)\) \+ 10\)/);
 assert.match(s,/document.addEventListener\("visibilitychange", check\)/);
 assert.doesNotMatch(s.split('// END SHOUT AUTH SHARED')[1],/sessionStorage.getItem\("shout_access_token"\)/);
});
function loginHarness(response,ok=true) {
 const h=harness(),handlers={};let sdk;
 Object.assign(h.c,{console:{log(){},error(){},warn(){}},URL,alert(){},document:{readyState:'complete',getElementById:()=>({style:{},addEventListener:(n,f)=>handlers[n]=f})},fetch:async()=>({ok,status:ok?200:503,json:async()=>response})});
 h.c.window.location={origin:'https://example.test',href:'/login',pathname:'/login'};
 h.c.window.Kakao=h.c.Kakao={isInitialized:()=>true,Auth:{login:options=>sdk=options}};
 vm.runInContext(source('05_Login.runtime.js'),h.c);
 handlers.click({preventDefault(){}});
 return {...h,getSDK:()=>sdk};
}
async function flush() {for(let i=0;i<8;i++) await Promise.resolve();}
test('mobile-compatible SDK login commits a complete record then returns to cart',async()=>{
 const h=loginHarness({response:{users_id:'user-b',access_token:'token-b'}});
 h.c.sessionStorage.setItem('shout_auth_intent',JSON.stringify({after:'start_payment',return_to:'/cart',created_at:h.c.Date.now(),cart_agreement:{version:1}}));
 h.getSDK().success({access_token:'token-b',expires_in:7200});await flush();
 assert.equal(h.auth.getUserId(),'user-b');assert.equal(h.auth.getAccessToken(),'token-b');assert.equal(h.c.window.location.href,'/cart');
 assert.ok(h.c.sessionStorage.getItem('shout_auth_intent'));
});
test('malformed login response never partially changes an account or returns to payment',async()=>{
 const h=loginHarness({response:{users_id:'other'}});login(h);
 h.getSDK().success({access_token:'new-token',expires_in:7200});await flush();
 assert.equal(h.auth.getUserId(),'user-a');assert.equal(h.auth.getAccessToken(),'token-a');assert.equal(h.c.window.location.href,'/login');
});
test('cancelled Kakao login stays on the login page',()=>{
 const h=loginHarness({});h.getSDK().fail({error:'cancelled'});assert.equal(h.c.window.location.href,'/login');assert.equal(h.auth.getUserId(),'');
});
test('embedded auth helpers and HTML script mirrors match canonical raw files',()=>{
 const auth=source('00_Auth.js');
 for(const raw of ['05_Login.runtime.js','04_MyPage-B.runtime.js','06_Admin-B.js']) assert.equal(part(source(raw),'// BEGIN SHOUT AUTH SHARED\n','// END SHOUT AUTH SHARED\n').replace('// BEGIN SHOUT AUTH SHARED\n',''),auth);
 for(const [raw,wrapped] of [['05_Login.runtime.js','05_Login-B.js'],['04_MyPage-B.runtime.js','04_MyPage-B.js'],['03_Cart-m-checkout.runtime.js','03_Cart-m-checkout.js'],['Payment-success-B.runtime.js','Payment(success)-B.js']]) assert.equal(source(wrapped).replace(/^<script>\s*/,'').replace(/\s*<\/script>\s*$/,'').trim(),source(raw).trim());
});

test('HTTP 200 without explicit Bubble confirmation cannot clear cart or report purchase success',()=>{
 const c={};vm.createContext(c);
 vm.runInContext(part(source('Payment-success-B.runtime.js'),'    function isPaymentConfirmed(', '    async function processPaymentConfirm()'),c);
 for(const data of [null,{}, {status:'success'}, {response:{}}, {response:{status:'failed'}}]) assert.equal(c.isPaymentConfirmed({ok:true},data),false);
 assert.equal(c.isPaymentConfirmed({ok:false},{response:{status:'success'}}),false);
 assert.equal(c.isPaymentConfirmed({ok:true},{response:{status:'success'}}),true);
});
test('PC and mobile reject empty, zero-price, or mismatched order responses',()=>{
 for(const n of ['03_Cart-v1-260616-2.js','03_Cart-m-checkout.runtime.js']) {
  const s=source(n),a=s.indexOf('const bubble = j && j.response;'),b=s.indexOf('totalAmount += amt;',a);
  assert.ok(a>=0&&b>a);const c={Number,Error};vm.createContext(c);
  const validate=vm.runInContext('(function(j,orderId){'+s.slice(a,b)+'return amt;})',c);
  for(const response of [null,{}, {order_id:'other',photo_count:1,amount:6000},{order_id:'order',photo_count:0,amount:6000},{order_id:'order',photo_count:1,amount:0}]) assert.throws(()=>validate({response},'order'),/INVALID_ORDER_RESPONSE/);
  assert.equal(validate({response:{order_id:'order',photo_count:5,amount:24900}},'order'),24900);
 }
});
