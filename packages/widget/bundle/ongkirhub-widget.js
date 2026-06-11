"use strict";var OngkirHubWidget=(()=>{var m=Object.defineProperty;var R=Object.getOwnPropertyDescriptor;var C=Object.getOwnPropertyNames;var w=Object.prototype.hasOwnProperty;var v=(e,t)=>{for(var r in t)m(e,r,{get:t[r],enumerable:!0})},$=(e,t,r,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of C(t))!w.call(e,o)&&o!==r&&m(e,o,{get:()=>t[o],enumerable:!(n=R(t,o))||n.enumerable});return e};var O=e=>$(m({},"__esModule",{value:!0}),e);var L={};v(L,{OngkirHubWidget:()=>p});var u=class extends Error{code;context;constructor(t,r,n={}){super(r),this.name="OngkirHubError",this.code=t,this.context=n}};function h(e){return e instanceof u}function P(e){return new Promise(t=>setTimeout(t,e))}async function T(e,t,r,n){let o=new AbortController,i=setTimeout(()=>o.abort(),n);try{return await e(t,{...r,signal:o.signal})}catch(a){throw a instanceof Error&&a.name==="AbortError"?new u("TIMEOUT_ERROR",`Request timed out after ${n}ms`,{url:t}):a}finally{clearTimeout(i)}}var c=class{baseUrl;fetchFn;timeoutMs;constructor(t){this.baseUrl=t.baseUrl.replace(/\/$/,""),this.fetchFn=t.fetchFn??fetch,this.timeoutMs=t.timeoutMs??3e4}async getQuotes(t){return this.requestWithRetry("POST","/v0/quotes",t,{retryOn4xx:!1})}async getHealth(){return this.requestWithRetry("GET","/health",void 0,{retryOn4xx:!1})}async requestWithRetry(t,r,n,o){let i=`${this.baseUrl}${r}`,a=3,s;for(let l=1;l<=a;l+=1)try{return await this.requestOnce(t,i,n)}catch(d){if(s=d,this.isRetryable(d,l,a,o.retryOn4xx)){await P(1e3*l);continue}throw d}throw s}isRetryable(t,r,n,o){if(r>=n||!(t instanceof u)||t.code==="PARSE_ERROR")return!1;if(t.code==="NETWORK_ERROR"||t.code==="TIMEOUT_ERROR")return!0;let i=t.context.status;return i===void 0?!1:i>=500?!0:i>=400&&i<500?o:!1}async requestOnce(t,r,n){let o={method:t,headers:{"content-type":"application/json",accept:"application/json"}};n!==void 0&&(o.body=JSON.stringify(n));let i;try{i=await T(this.fetchFn,r,o,this.timeoutMs)}catch(s){throw s instanceof u&&s.code==="TIMEOUT_ERROR"?s:new u("NETWORK_ERROR",s instanceof Error?s.message:"Network request failed",{url:r})}let a;try{a=await i.json()}catch{throw new u("PARSE_ERROR",`Response from ${r} was not valid JSON`,{status:i.status,url:r})}if(!i.ok){let s=a,l=typeof s.error=="string"?s.error:typeof s.message=="string"?s.message:`Request failed with status ${i.status}`,d=this.inferErrorCode(i.status,s);throw new u(d,l,{status:i.status,url:r,details:s.details??void 0,providerKey:typeof s.providerKey=="string"?s.providerKey:void 0})}return a}inferErrorCode(t,r){return t===400?"VALIDATION_ERROR":t===502?"PROVIDER_ERROR":t>=500?"UPSTREAM_ERROR":r.providerKey!==void 0?"PROVIDER_ERROR":"UNKNOWN_ERROR"}};function f(e,t,r,n){let o=document.createElement("fieldset"),i=document.createElement("label");i.htmlFor=e,i.textContent=t;let a=document.createElement("input");return a.type=r,a.id=e,a.value=n,o.appendChild(i),o.appendChild(a),o}function g(e,t,r,n){let o=document.createElement("form");o.className=`${e}-form`,o.appendChild(f(`${e}-origin`,t.originPostalCode,"text",r)),o.appendChild(f(`${e}-destination`,t.destinationPostalCode,"text",n)),o.appendChild(f(`${e}-weight`,t.weight,"number","1000"));let i=document.createElement("button");return i.type="submit",i.textContent=t.submit,o.appendChild(i),o}function E(e,t){let r=document.createElement("div");return r.className=`${e}-error`,r.textContent=t,r}function b(e,t){let r=document.createElement("div");r.className=`${e}-results`;for(let n of t){let o=document.createElement("div");o.className=`${e}-result`;let i=document.createElement("div");i.className=`${e}-result-name`,i.textContent=`${n.serviceName} \u2014 ${n.providerKey}`;let a=document.createElement("div");a.className=`${e}-result-meta`;let s=n.estimatedDuration?`${n.estimatedDuration.value} ${n.estimatedDuration.unit}`:"N/A";a.textContent=`${n.price.amount.toLocaleString()} ${n.price.currency} \xB7 ${s}`,o.appendChild(i),o.appendChild(a),r.appendChild(o)}return r}function y(e){return`
.${e} {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 420px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.${e} fieldset {
  border: none;
  padding: 0;
  margin: 0 0 12px;
}
.${e} label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  color: #374151;
}
.${e} input[type="text"],
.${e} input[type="number"] {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.${e} button {
  width: 100%;
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #2563eb;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.${e} button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.${e}-error {
  margin-top: 10px;
  padding: 10px;
  font-size: 14px;
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
}
.${e}-results {
  margin-top: 12px;
}
.${e}-result {
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}
.${e}-result-name {
  font-weight: 600;
  font-size: 14px;
}
.${e}-result-meta {
  font-size: 13px;
  color: #6b7280;
  margin-top: 2px;
}
`}var x={originPostalCode:"Origin Postal Code",destinationPostalCode:"Destination Postal Code",weight:"Weight (grams)",submit:"Get Quotes",loading:"Loading...",noResults:"No shipping options found.",errorPrefix:"Error:"};var p=class{client;container;prefix;labels=x;defaultOriginPostal;defaultDestPostal;mounted=!1;abortController=null;styleEl=null;rootEl=null;constructor(t){if(!t.apiUrl||!t.container)throw new Error("OngkirHubWidget requires apiUrl and container");this.client=new c({baseUrl:t.apiUrl}),this.container=typeof t.container=="string"?document.querySelector(t.container)??(()=>{throw new Error(`Container not found: ${t.container}`)})():t.container,this.prefix=t.themePrefix??"ongkirhub-widget",this.defaultOriginPostal=t.defaultOriginPostalCode??"",this.defaultDestPostal=t.defaultDestinationPostalCode??"",t.labels&&Object.assign(this.labels,t.labels)}mount(){if(this.mounted)return;this.mounted=!0,this.styleEl=document.createElement("style"),this.styleEl.textContent=y(this.prefix),document.head.appendChild(this.styleEl),this.rootEl=document.createElement("div"),this.rootEl.className=this.prefix;let t=g(this.prefix,this.labels,this.defaultOriginPostal,this.defaultDestPostal);t.addEventListener("submit",r=>{r.preventDefault(),this.handleSubmit(t)}),this.rootEl.appendChild(t),this.container.appendChild(this.rootEl)}async handleSubmit(t){this.clearMessages();let r=t.querySelector(`#${this.prefix}-origin`),n=t.querySelector(`#${this.prefix}-destination`),o=t.querySelector(`#${this.prefix}-weight`),i=r?.value.trim()??"",a=n?.value.trim()??"",s=Number(o?.value??0);if(!i||!a||!s||s<=0){this.showError("Please fill in all fields with valid values.");return}let l=t.querySelector("button[type='submit']");l&&(l.textContent=this.labels.loading,l.disabled=!0);try{let d=await this.client.getQuotes({origin:{method:"location",countryCode:"ID",postalCode:i},destination:{method:"location",countryCode:"ID",postalCode:a},parcels:[{weightGrams:s}],totalWeightGrams:s});d.quotes.length===0?this.showError(this.labels.noResults):this.rootEl.appendChild(b(this.prefix,d.quotes))}catch(d){h(d)?this.showError(`${this.labels.errorPrefix} ${d.message}`):d instanceof Error?this.showError(`${this.labels.errorPrefix} ${d.message}`):this.showError(`${this.labels.errorPrefix} An unexpected error occurred.`)}finally{l&&(l.textContent=this.labels.submit,l.disabled=!1)}}showError(t){this.rootEl.appendChild(E(this.prefix,t))}clearMessages(){if(!this.rootEl)return;this.rootEl.querySelectorAll(`.${this.prefix}-error`).forEach(n=>n.remove()),this.rootEl.querySelectorAll(`.${this.prefix}-results`).forEach(n=>n.remove())}destroy(){this.mounted&&(this.mounted=!1,this.styleEl&&this.styleEl.parentNode&&this.styleEl.parentNode.removeChild(this.styleEl),this.rootEl&&this.rootEl.parentNode&&this.rootEl.parentNode.removeChild(this.rootEl),this.styleEl=null,this.rootEl=null,this.abortController?.abort())}};return O(L);})();
