"use strict";var I=Object.defineProperty;var o=(e,t)=>I(e,"name",{value:t,configurable:!0});var h=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var S=h((J,m)=>{"use strict";var b=require("fs"),P=require("path"),y=o(e=>JSON.parse(b.readFileSync(P.join(__dirname,e)).toString().replace(/\/\*[.\s\S]*?\*\//gi,"")),"readConfig"),g=y("../properties_pane/field_level/fieldLevelConfig.json"),F=y("../properties_pane/container_level/containerLevelConfig.json");m.exports={getTargetFieldLevelPropertyNames(e,t){return!g.structure[e]||!Array.isArray(g.structure[e])?[]:g.structure[e].filter(r=>typeof r=="object"&&r.isTargetProperty?r.dependency?t[r.dependency.key]!==r.dependency.value?!1:!(Array.isArray(r.options)&&!r.options.includes(t[r.propertyName])):!0:!1).map(r=>r.propertyKeyword)},getFieldProperties(e,t,r){return this.getTargetFieldLevelPropertyNames(e,t).reduce((i,s)=>(Object.prototype.hasOwnProperty.call(t,s)?i[s]=t[s]:Object.prototype.hasOwnProperty.call(t,r[s])&&(i[r[s]]=t[r[s]]),i),{})},getContainerLevelProperties(){let e=[];return F.forEach(t=>{t.structure.forEach(r=>{r.isTargetProperty&&e.push(r.propertyKeyword)})}),e}}});var j=h((x,d)=>{"use strict";var c=o((e,t,r)=>{if(e.GUID===t)return r;if(e.properties)return Object.keys(e.properties).reduce((n,i)=>n||c(e.properties[i],t,[...r,e.properties[i].GUID]),void 0);if(e.items)return Array.isArray(e.items)?e.items.reduce((n,i)=>n||c(i,t,[...r,i.GUID]),void 0):c(e.items,t,[...r,e.items.GUID])},"getPathById"),u=o((e,t)=>{if(e.properties)return Object.keys(e.properties).reduce((r,n)=>{if(r.length)return r;let i=e.properties[n];return i.GUID!==t[0]?r:t.length===1?[n]:[n,...u(i,t.slice(1))]},[]);if(Array.isArray(e.items))return e.items.reduce((r,n,i)=>r.length||n.GUID!==t[0]?r:t.length===1?["["+i+"]"]:["["+i+"]",...u(n,t.slice(1),"["+i+"]")],[]);if(Object(e.items)===e.items){let r=e.items;return r.GUID!==t[0]?[""]:t.length===1?["[0]"]:["[0]",...u(r,t.slice(1),"[0]")]}},"getNameByPath"),N=o(e=>e.reduce((t,r)=>/\[\d+\]/.test(r)?[...t.slice(0,-1),t[t.length-1]+r]:[...t,r],[]),"joinIndex"),v=o((e,t)=>{let r=c(t,e,[]);if(r){let n=N(u(t,r,""));return n[n.length-1]||""}else return""},"findFieldNameById"),C=o((e,t)=>{for(let r=0;r<t.length;r++){let n=c(t[r],e,[]);if(n)return u(t[r],n,"").slice(1).filter(s=>!/\[\d+\]/.test(s)).join(".")}return""},"getPathName"),L=o((e,t)=>e.reduce((r,n)=>{for(let i=0;i<t.length;i++){let s=v(n,t[i]);if(s)return[...r,s]}return r},[]),"getNamesByIds");d.exports={getNamesByIds:L,getPathName:C}});var A=S(),O=j();module.exports={generateScript(e,t,r){let{jsonSchema:n,modelData:i,entityData:s,isUpdateScript:f}=e,l=e.containerData||{},a="",_=this.getFieldsSchema({jsonSchema:JSON.parse(n),internalDefinitions:JSON.parse(e.internalDefinitions),modelDefinitions:JSON.parse(e.modelDefinitions),externalDefinitions:JSON.parse(e.externalDefinitions)}),D=this.getTypeSchema(s,_),p=this.getMappingScript(l,D);f?a=this.getCurlScript(p,i,l):a+=this.getKibanaScript(p,l),r(null,a)},getCurlScript(e,t,r){let n=t.host||"localhost",i=t.port||9200,s=r.name||"",l=+(t.dbVersion||"").split(".").shift()>=7?"&include_type_name=true":"";return`curl -XPUT '${n}:${i}/${s.toLowerCase()}?pretty${l}' -H 'Content-Type: application/json' -d '
${JSON.stringify(e,null,4)}
'`},getKibanaScript(e,t){return`PUT /${(t.name||"").toLowerCase()}
${JSON.stringify(e,null,4)}`},getFieldsSchema(e){let{jsonSchema:t}=e,r={};return t.properties&&t.properties._source&&t.properties._source.properties&&(r=this.getSchemaByItem(t.properties._source.properties,e)),r},getSchemaByItem(e,t){let r={};for(let n in e){let i=e[n];r[n]=this.getField(i,t)}return r},getField(e,t){let r={},n=A.getFieldProperties(e.type,e,{}),i=this.getFieldType(e);if(i!=="object"&&i!=="array"&&(r.type=i),i==="object"&&(r.properties={}),this.setProperties(r,n,t),i==="alias")return Object.assign({},r,this.getAliasSchema(e,t));if(i==="join")return Object.assign({},r,this.getJoinSchema(e));if(["completion","sparse_vector","dense_vector","geo_shape","geo_point","rank_feature","rank_features"].includes(i))return r;if(e.properties)r.properties=this.getSchemaByItem(e.properties,t);else if(e.items){let s=e.items;Array.isArray(e.items)&&(s=e.items[0]),r=Object.assign(r,this.getField(s,t))}return r},getFieldType(e){switch(e.type){case"geo-shape":return"geo_shape";case"geo-point":return"geo_point";case"number":return e.mode||"long";case"string":return e.mode||"text";case"range":return e.mode||"integer_range";case"null":return"long";default:return e.type}},setProperties(e,t,r){for(let n in t)if(n==="stringfields")try{e.fields=JSON.parse(t[n])}catch{}else if(this.isFieldList(t[n])){let i=O.getNamesByIds(t[n].map(s=>s.keyId),[r.jsonSchema,r.internalDefinitions,r.modelDefinitions,r.externalDefinitions]);i.length&&(e[n]=i.length===1?i[0]:i)}else e[n]=t[n];return e},getTypeSchema(e,t){let r={};return e.dynamic&&(r.dynamic=e.dynamic),r.properties=t,{[(e.collectionName||"").toLowerCase()]:r}},getMappingScript(e,t){let r={},n=this.getSettings(e),i=this.getAliases(e);return n&&(r.settings=n),i&&(r.aliases=i),r.mappings=t,r},getSettings(e){let t;return A.getContainerLevelProperties().forEach(n=>{e[n]&&(t||(t={}),t[n]=e[n])}),t},getAliases(e){let t;return e.aliases&&e.aliases.forEach(r=>{if(r.name){if(t||(t={}),t[r.name]={},r.filter){let n="";try{n=JSON.parse(r.filter)}catch{}t[r.name].filter={term:n}}r.routing&&(t[r.name].routing=r.routing)}}),t},isFieldList(e){return!Array.isArray(e)||!e[0]?!1:!!e[0].keyId},getJoinSchema(e){return Array.isArray(e.relations)?{relations:e.relations.reduce((r,n)=>!n.parent||!Array.isArray(n.children)?r:n.children.length===1?Object.assign({},r,{[n.parent]:(n.children[0]||{}).name}):Object.assign({},r,{[n.parent]:n.children.map(i=>i.name||"")}),{})}:{}},getAliasSchema(e,t){return Array.isArray(e.path)?e.path.length===0?{}:{path:O.getPathName(e.path[0].keyId,[t.jsonSchema,t.internalDefinitions,t.modelDefinitions,t.externalDefinitions])}:{}}};
