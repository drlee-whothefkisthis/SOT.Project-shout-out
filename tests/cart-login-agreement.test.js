const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const repo = process.env.SOT_TEST_REPO || path.resolve(__dirname, '..');
const cart = fs.readFileSync(path.join(repo, '03-Cart.js'), 'utf8');
const mobile = fs.readFileSync(path.join(repo, '03-Checkout.js'), 'utf8');
function section(source, from, to) {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  assert.ok(a >= 0 && b > a, from);
  return source.slice(a, b);
}
function storage(values = {}) {
  const map = new Map(Object.entries(values));
  return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,String(v)), removeItem: k => map.delete(k) };
}
function cartHarness({ user = '', token = '', mobileMode = false, checked = false, items = [{_id:'photo-a'}], amount = 6000, intent } = {}) {
  const state = { modal:0, checkout:0, nudges:0 };
  const context = {
    Date, JSON, Number, String, console,
    AUTH_INTENT_KEY:'shout_auth_intent', AUTH_INTENT_TTL_MS:3600000, AUTH_LOGIN_URL:'/login',
    localStorage:storage({'shout_users_id':user}),
    sessionStorage:storage({'shout_access_token':token,...(intent ? {shout_auth_intent:JSON.stringify(intent)} : {})}),
    window:{ location:{href:'https://example.test/cart?tracking=1',origin:'https://example.test'}, addEventListener(){} },
    agreeCheckbox:{checked,classList:{remove(){}}}, checkoutLocked:true, checkoutBtn:{}, cartItems:items,
    getItemId:it=>it._id, getSelectedItemsFrom:all=>all, getSelectedCheckoutAmount:()=>amount,
    nudgeAgreeCheckbox:()=>state.nudges++, alert:()=>assert.fail('unexpected empty cart'), warn(){},
    setInitialCartLoadingState(){}, ensureCartUi(){},loadCartFromStorage(){},rerenderCartUI(){},
    renderMultiEventAccordion:async()=>true,renderCartList(){},ensurePaymentWidgetDom(){},
    isMobileCheckoutMode:()=>mobileMode,goToCheckoutPage:()=>state.checkout++,openPaymentModal:()=>state.modal++,
    document:{querySelectorAll:()=>[]},setTimeout:fn=>fn()
  };
  vm.createContext(context);
  vm.runInContext(section(cart,'  function hasPaymentLogin()', '  function isMobileCheckoutMode()') +
    section(cart,'  async function init()','  window.addEventListener("pageshow", init);'), context);
  return {context,state};
}
for (const mobileMode of [false,true]) {
  for (const [name,user,token] of [['guest','',''],['token only','','token-a']]) {
    test(`${mobileMode?'mobile':'desktop'}: ${name} logs in before payment UI`,async()=>{
      const {context:c,state} = cartHarness({user,token,mobileMode,checked:true});
      await c.init(); c.checkoutBtn.onclick({preventDefault(){}});
      assert.equal(c.window.location.href,'/login');
      assert.equal(state.modal + state.checkout,0);
      const intent=JSON.parse(c.sessionStorage.getItem('shout_auth_intent'));
      assert.equal(intent.after,'start_payment');
      assert.deepEqual(intent.cart_agreement.photo_ids,['photo-a']);
      assert.equal(intent.return_to,'https://example.test/cart?tracking=1');
    });
  }
  test(`${mobileMode?'mobile':'desktop'}: login round trip restores agreement and resumes`,async()=>{
    const before=cartHarness({checked:true,mobileMode});
    assert.equal(before.context.canOpenPaymentModalWithPrecheck(),false);
    const intent=JSON.parse(before.context.sessionStorage.getItem('shout_auth_intent'));
    const {context:c,state}=cartHarness({user:'user-a',token:'token-a',intent,mobileMode});
    await c.init();
    assert.equal(c.agreeCheckbox.checked,true);
    assert.equal(c.checkoutLocked,false);
    assert.equal(state[mobileMode?'checkout':'modal'],1);
    assert.equal(state.nudges,0);
    assert.equal(c.sessionStorage.getItem('shout_auth_intent'),null);
  });
}
test('unchecked agreement is never saved as consent',()=>{
  const {context:c,state}=cartHarness({user:'user-a'});
  assert.equal(c.getCartAgreementSnapshot(),null);
  assert.equal(c.canOpenPaymentModalWithPrecheck(),false);
  assert.equal(c.sessionStorage.getItem('shout_auth_intent'),null);
  assert.equal(state.nudges,1);
});
for (const [name,change] of [
  ['different photo',{items:[{_id:'photo-b'}]}],['different price',{amount:12000}],
  ['expired intent',{created_at:Date.now()-3600001}],['future intent',{created_at:Date.now()+3600000}],
  ['missing timestamp',{created_at:undefined}],['no prior consent',{cart_agreement:null}]
]) {
  test(`agreement is not restored for ${name}`,async()=>{
    const intent={after:'start_payment',created_at:Date.now(),cart_agreement:{version:1,photo_ids:['photo-a'],amount:6000}};
    if ('created_at' in change) intent.created_at=change.created_at;
    if ('cart_agreement' in change) intent.cart_agreement=change.cart_agreement;
    const {context:c,state}=cartHarness({user:'user-a',token:'token-a',intent,...change});
    await c.init();
    assert.equal(c.agreeCheckbox.checked,false);
    assert.equal(state.modal+state.checkout,0);
  });
}
function mobileHarness(user,token) {
  const calls=[];
  const c={Date,Number,String,JSON,console,AUTH_INTENT_KEY:'shout_auth_intent',AUTH_INTENT_TTL_MS:3600000,AUTH_LOGIN_URL:'/login',
    localStorage:storage({'shout_users_id':user}),sessionStorage:storage({'shout_access_token':token}),
    window:{location:{href:'https://example.test/checkout'}},appendShoutTrackingToUrl:p=>p,warn(){},TossPayments:()=>{},
    loadCartFromStorage:()=>calls.push('load'),ensureSelectedIds(){},ensureCheckoutDom:()=>calls.push('DOM'),
    getSelectedItems:()=>[{_id:'photo-a'}],getPrimaryIdentifier:()=>({value:'1234'}),
    updateSummary(){},bindEvents(){},initPaymentWidget:async()=>calls.push('Toss'),
    renderErrorState:()=>assert.fail('unexpected error'),renderEmptyState:()=>assert.fail('unexpected empty')};
  vm.createContext(c);
  vm.runInContext(section(mobile,'  function hasCheckoutLogin()', '  async function startPayment()')+
    section(mobile,'  function consumeCheckoutAuthIntent()', '  bootstrap();'),c);
  return {c,calls};
}
for(const [user,token] of [['',''],['','token-a']]) {
  test(`direct checkout blocks payment UI with credentials ${!!user}/${!!token.trim()}`,()=>{
    const {c,calls}=mobileHarness(user,token);c.bootstrap();
    assert.equal(c.window.location.href,'/login');assert.deepEqual(calls,[]);
    assert.equal(JSON.parse(c.sessionStorage.getItem('shout_auth_intent')).after,'checkout_payment');
  });
}
test('authenticated direct checkout renders Toss after authentication guard',()=>{
  const {c,calls}=mobileHarness('user-a','token-a');c.bootstrap();assert.deepEqual(calls,['load','DOM','Toss']);
});
test('mobile auth intent is consumed once the user ID exists',()=>{
  const {c}=mobileHarness('','');
  c.sessionStorage.setItem('shout_auth_intent',JSON.stringify({after:'checkout_payment',created_at:Date.now()}));
  c.consumeCheckoutAuthIntent();assert.ok(c.sessionStorage.getItem('shout_auth_intent'));
  c.localStorage.setItem('shout_users_id','user-a');c.consumeCheckoutAuthIntent();
  assert.equal(c.sessionStorage.getItem('shout_auth_intent'),null);
});

for(const mobileMode of [false,true]) {
 test(`${mobileMode?'mobile':'desktop'} ID-only payment opens without a token`,async()=>{
  const {context:c,state}=cartHarness({user:'user-a',checked:true,mobileMode});await c.init();
  c.checkoutBtn.onclick({preventDefault(){}});
  assert.equal(state[mobileMode?'checkout':'modal'],1);assert.notEqual(c.window.location.href,'/login');
 });
}
test('ID-only direct mobile checkout loads Toss without re-login',()=>{
 const {c,calls}=mobileHarness('user-a','');c.bootstrap();assert.deepEqual(calls,['load','DOM','Toss']);
});
