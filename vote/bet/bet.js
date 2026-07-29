(() => {
  "use strict";
  const ODDS_DATA = window.ZENRACE_ODDS_DATA || {};
  const riders = [
    {car:1,name:"黒川 京介",profile:"川口 33期 27歳"},{car:2,name:"鈴木 圭一郎",profile:"浜松 32期 31歳"},
    {car:3,name:"青山 周平",profile:"伊勢崎 31期 41歳"},{car:4,name:"金子 大輔",profile:"浜松 29期 45歳"},
    {car:5,name:"長田 稚也",profile:"飯塚 34期 25歳"},{car:6,name:"佐藤 励",profile:"川口 35期 25歳"},
    {car:7,name:"鈴木 宏和",profile:"浜松 32期 39歳"},{car:8,name:"佐藤 摩弥",profile:"川口 31期 33歳 <span aria-label=\"女子選手\" class=\"female-mark\">♥</span>"}
  ];
  const columns = ["first","second","third","box"];
  const selected = Object.fromEntries(columns.map(key => [key,new Set()]));
  const activeTypes = new Set(["3連単"]);
  const BET_TYPE_ORDER = ["3連単","3連複","2連単","2連複","ワイド","単勝"];
  const removedSelections = new Set();
  const CONFIRM_STORAGE_KEY = "zenrace:bet-confirmation:v1";
  const body = document.getElementById("bet-table-body");
  const list = document.getElementById("selection-list");
  const count = document.getElementById("selection-count");
  const confirm = document.getElementById("bet-confirm");

  function rowHtml(rider){
    return `<tr><td class="car-number car-${rider.car}">${rider.car}</td><td class="rider-cell"><span class="rider-main">${rider.name}</span><span class="rider-profile">${rider.profile}</span></td>${columns.map((key,index)=>`<td class="pick-cell${index===3?" box-divider":""}"><button class="pick-button entry-${rider.car}" type="button" data-column="${key}" data-car="${rider.car}" aria-pressed="false">${rider.car}</button></td>`).join("")}</tr>`;
  }
  body.innerHTML = riders.map(rowHtml).join("");

  function permutations(values,length){
    const result=[];
    function walk(path,remaining){
      if(path.length===length){result.push(path.slice());return;}
      remaining.forEach((value,index)=>walk(path.concat(value),remaining.slice(0,index).concat(remaining.slice(index+1))));
    }
    walk([],values.slice());return result;
  }
  function distinctProduct(groups){
    let rows=[[]];
    groups.forEach(group=>{rows=rows.flatMap(row=>group.filter(v=>!row.includes(v)).map(v=>row.concat(v)));});
    return rows;
  }
  function combosFor(type){
    const a=[...selected.first],b=[...selected.second],c=[...selected.third],box=[...selected.box];
    if(type==="単勝") return [...new Set([...a,...b,...c,...box])].map(v=>[v]);
    if(type==="2連単") {
      let rows=distinctProduct([a,b]);
      if(document.getElementById("multi-reverse-option").checked) rows=rows.concat(rows.map(x=>[x[1],x[0]]));
      if(box.length>=2) rows=rows.concat(permutations(box,2));
      return rows;
    }
    if(type==="2連複"||type==="ワイド"){
      const source=box.length>=2?box:[...new Set([...a,...b])];
      const out=[];for(let i=0;i<source.length;i++)for(let j=i+1;j<source.length;j++)out.push([source[i],source[j]]);return out;
    }
    if(type==="3連複"){
      const source=box.length>=3?box:[...new Set([...a,...b,...c])];
      const out=[];for(let i=0;i<source.length;i++)for(let j=i+1;j<source.length;j++)for(let k=j+1;k<source.length;k++)out.push([source[i],source[j],source[k]]);return out;
    }
    let rows=distinctProduct([a,b,c]);
    if(box.length>=3) rows=rows.concat(permutations(box,3));
    if(document.getElementById("multi-reverse-option").checked) rows=rows.flatMap(row=>permutations(row,3));
    return rows;
  }
  function dedupe(rows){const seen=new Set();return rows.filter(row=>{const key=row.join("-");if(seen.has(key))return false;seen.add(key);return true;});}
  function oddsKey(type,cars){
    const values=cars.slice();
    if(type==="3連複"||type==="2連複"||type==="ワイド") values.sort((a,b)=>a-b);
    return values.join("-");
  }
  const oddsLookup=Object.fromEntries(Object.entries(ODDS_DATA).map(([type,records])=>[type,new Map((records||[]).map(record=>[oddsKey(type,record.cars),record]))]));
  function oddsRecord(type,cars){return oddsLookup[type]?.get(oddsKey(type,cars))||null;}
  function formatOdds(value){
    const number=Number(value);
    if(!Number.isFinite(number)) return "－";
    return number>=1000?String(Math.round(number)):number.toFixed(1);
  }
  function selectionOdds(type,record){
    if(!record) return "－";
    if(type==="ワイド"){
      const values=Array.isArray(record.odds)?record.odds:[record.odds,record.odds];
      return `${formatOdds(values[0])}～${formatOdds(values[1])}`;
    }
    return formatOdds(record.odds);
  }
  function carBadge(car){return `<span class="selection-car car-${car}">${car}</span>`;}
  function selectionKey(type,cars){return `${type}:${cars.join("-")}`;}
  function selectionGroups(){
    return BET_TYPE_ORDER.filter(type=>activeTypes.has(type)).map(type=>{
      const allEntries=dedupe(combosFor(type)).map(cars=>({type,cars,record:oddsRecord(type,cars),key:selectionKey(type,cars)}));
      const entries=allEntries.filter(entry=>!removedSelections.has(entry.key));
      return {type,entries,generatedCount:allEntries.length,removedCount:allEntries.length-entries.length};
    }).filter(group=>group.generatedCount);
  }
  function renderSelections(){
    const groups=selectionGroups();
    const total=groups.reduce((sum,group)=>sum+group.entries.length,0);
    count.textContent=`${total}点`;confirm.hidden=total===0;
    if(!total){list.innerHTML='<div class="selection-empty">買い目を選択してください</div>';return;}
    list.innerHTML=groups.filter(group=>group.entries.length).map(group=>`<section class="selection-group" data-selection-type="${group.type}" aria-label="${group.type}の選択一覧">${group.entries.map(entry=>`<div class="selection-row" data-selection-key="${entry.key}"><span class="selection-type">${entry.type}</span><span class="selection-combo">${entry.cars.map(carBadge).join("")}</span><span class="selection-odds">${selectionOdds(entry.type,entry.record)}</span><span class="selection-popularity">${entry.record?`${entry.record.rank}人気`:"－"}</span><button class="selection-remove" type="button" data-remove-key="${entry.key}">消</button></div>`).join("")}</section>`).join("");
    list.querySelectorAll("[data-remove-key]").forEach(button=>button.addEventListener("click",()=>{
      removedSelections.add(button.dataset.removeKey);
      renderSelections();
    }));
  }
  function confirmationPayload(){
    const groups=selectionGroups().filter(group=>group.entries.length).map(group=>({
      type:group.type,
      generatedCount:group.generatedCount,
      removedCount:group.removedCount,
      entries:group.entries.map(entry=>({
        cars:entry.cars.slice(),
        rank:entry.record?.rank??null,
        odds:entry.record?.odds??null
      }))
    }));
    return {
      version:1,
      createdAt:new Date().toISOString(),
      selections:Object.fromEntries(columns.map(key=>[key,[...selected[key]].sort((a,b)=>a-b)])),
      multiReverse:document.getElementById("multi-reverse-option").checked,
      groups
    };
  }
  function syncButton(button){const key=button.dataset.column,car=Number(button.dataset.car),on=selected[key].has(car);button.classList.toggle("selected",on);button.setAttribute("aria-pressed",String(on));}
  function syncCar(car){body.querySelectorAll(`[data-car="${car}"]`).forEach(syncButton);}
  function syncAllButtons(){body.querySelectorAll(".pick-button").forEach(syncButton);}
  function selectBoxCar(car,on){
    if(on){
      selected.box.add(car);
      selected.first.add(car);
      selected.second.add(car);
      selected.third.add(car);
    }else{
      selected.box.delete(car);
      selected.first.delete(car);
      selected.second.delete(car);
      selected.third.delete(car);
    }
  }
  body.querySelectorAll(".pick-button").forEach(button=>button.addEventListener("click",()=>{
    const key=button.dataset.column,car=Number(button.dataset.car);
    if(key==="box"){
      selectBoxCar(car,!selected.box.has(car));
    }else{
      selected[key].has(car)?selected[key].delete(car):selected[key].add(car);
      if(!selected[key].has(car)) selected.box.delete(car);
    }
    syncCar(car);
    renderSelections();
  }));
  document.querySelectorAll("[data-column-all]").forEach(button=>button.addEventListener("click",()=>{
    const key=button.dataset.columnAll;
    if(key==="box") riders.forEach(r=>selectBoxCar(r.car,true));
    else riders.forEach(r=>selected[key].add(r.car));
    syncAllButtons();
    renderSelections();
  }));
  document.querySelectorAll("[data-column-clear]").forEach(button=>button.addEventListener("click",()=>{
    const key=button.dataset.columnClear;
    if(key==="box") riders.forEach(r=>selectBoxCar(r.car,false));
    else{selected[key].clear();selected.box.clear();}
    syncAllButtons();
    renderSelections();
  }));
  document.querySelectorAll(".bet-type-tab").forEach(tab=>tab.addEventListener("click",()=>{const type=tab.dataset.betType;activeTypes.has(type)?activeTypes.delete(type):activeTypes.add(type);if(!activeTypes.size)activeTypes.add("3連単");document.querySelectorAll(".bet-type-tab").forEach(item=>{const on=activeTypes.has(item.dataset.betType);item.classList.toggle("active",on);item.setAttribute("aria-pressed",String(on));});renderSelections();}));
  document.getElementById("multi-reverse-option").addEventListener("change",renderSelections);
  confirm.addEventListener("click",()=>{
    const payload=confirmationPayload();
    if(!payload.groups.length) return;
    try{sessionStorage.setItem(CONFIRM_STORAGE_KEY,JSON.stringify(payload));}catch(error){console.warn("投票確認データを保存できませんでした。",error);}
    window.location.href="confirm/";
  });
})();
