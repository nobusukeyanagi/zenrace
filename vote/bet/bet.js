(() => {
  "use strict";
  const riders = [
    {car:1,name:"黒川 京介",profile:"川口 33期 27歳"},{car:2,name:"鈴木 圭一郎",profile:"浜松 32期 31歳"},
    {car:3,name:"青山 周平",profile:"伊勢崎 31期 41歳"},{car:4,name:"金子 大輔",profile:"浜松 29期 45歳"},
    {car:5,name:"長田 稚也",profile:"飯塚 34期 25歳"},{car:6,name:"佐藤 励",profile:"川口 35期 25歳"},
    {car:7,name:"鈴木 宏和",profile:"浜松 32期 39歳"},{car:8,name:"佐藤 摩弥",profile:"川口 31期 33歳 ♥"}
  ];
  const columns = ["first","second","third","box"];
  const selected = Object.fromEntries(columns.map(key => [key,new Set()]));
  const activeTypes = new Set(["3連単"]);
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
      if(document.getElementById("reverse-option").checked) rows=rows.concat(rows.map(x=>[x[1],x[0]]));
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
    if(document.getElementById("multi-option").checked) rows=rows.flatMap(row=>permutations(row,3));
    return rows;
  }
  function dedupe(rows){const seen=new Set();return rows.filter(row=>{const key=row.join("-");if(seen.has(key))return false;seen.add(key);return true;});}
  function fakeOdds(type,cars){const base=cars.reduce((sum,v,i)=>sum+v*(i+2),0)+(type.length*3);return Math.max(1.1,Number((base*1.37).toFixed(1)));}
  function carBadge(car){return `<span class="selection-car car-${car}">${car}</span>`;}
  function renderSelections(){
    const entries=[];
    activeTypes.forEach(type=>dedupe(combosFor(type)).forEach(cars=>entries.push({type,cars,odds:fakeOdds(type,cars)})));
    count.textContent=`${entries.length}点`;confirm.hidden=entries.length===0;
    if(!entries.length){list.innerHTML='<div class="selection-empty">買い目を選択してください</div>';return;}
    list.innerHTML=entries.map((entry,index)=>`<div class="selection-row" data-selection-index="${index}"><span class="selection-type">${entry.type}</span><span class="selection-combo">${entry.cars.map(carBadge).join("")}</span><span class="selection-odds">${entry.odds.toFixed(1)}</span><span class="selection-amount"><input type="number" min="100" step="100" value="100" aria-label="投票金額"></span><button class="selection-remove" type="button" data-remove-index="${index}">消</button></div>`).join("");
    list.querySelectorAll("[data-remove-index]").forEach((button,index)=>button.addEventListener("click",()=>{button.closest(".selection-row").remove();const left=list.querySelectorAll(".selection-row").length;count.textContent=`${left}点`;confirm.hidden=left===0;if(!left)list.innerHTML='<div class="selection-empty">買い目を選択してください</div>';}));
  }
  function syncButton(button){const key=button.dataset.column,car=Number(button.dataset.car),on=selected[key].has(car);button.classList.toggle("selected",on);button.setAttribute("aria-pressed",String(on));}
  body.querySelectorAll(".pick-button").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.column,car=Number(button.dataset.car);selected[key].has(car)?selected[key].delete(car):selected[key].add(car);syncButton(button);renderSelections();}));
  document.querySelectorAll("[data-column-all]").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.columnAll;riders.forEach(r=>selected[key].add(r.car));body.querySelectorAll(`[data-column="${key}"]`).forEach(syncButton);renderSelections();}));
  document.querySelectorAll("[data-column-clear]").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.columnClear;selected[key].clear();body.querySelectorAll(`[data-column="${key}"]`).forEach(syncButton);renderSelections();}));
  document.querySelectorAll(".bet-type-tab").forEach(tab=>tab.addEventListener("click",()=>{const type=tab.dataset.betType;activeTypes.has(type)?activeTypes.delete(type):activeTypes.add(type);if(!activeTypes.size)activeTypes.add("3連単");document.querySelectorAll(".bet-type-tab").forEach(item=>{const on=activeTypes.has(item.dataset.betType);item.classList.toggle("active",on);item.setAttribute("aria-pressed",String(on));});renderSelections();}));
  document.getElementById("multi-option").addEventListener("change",renderSelections);
  document.getElementById("reverse-option").addEventListener("change",renderSelections);
})();
