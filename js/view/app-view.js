(function(global){
  'use strict';
  const SPECS={
    RGB:[['R',0,255,1],['G',0,255,1],['B',0,255,1]],
    CMYK:[['C',0,100,0.1],['M',0,100,0.1],['Y',0,100,0.1],['K',0,100,0.1]],
    LAB:[['L*',0,100,0.01],['a*',-128,127,0.01],['b*',-128,127,0.01]]
  };
  class AppView{
    constructor(){ this.root=document.getElementById('models'); this.modelEls={}; this.buildModels(); }
    buildModels(){
      for(const [model,spec] of Object.entries(SPECS)){
        const card=document.createElement('section'); card.className='model-card'; card.dataset.model=model;
        card.innerHTML=`<div class="model-head"><h2>${model}</h2></div><div class="channels"></div>`;
        const channels=card.querySelector('.channels');
        this.modelEls[model]=[];
        spec.forEach(([label,min,max,step],idx)=>{
          const row=document.createElement('div'); row.className='channel';
          row.innerHTML=`<label>${label}</label><div class="slider-wrap"><input type="range" min="${min}" max="${max}" step="${step}" data-model="${model}" data-index="${idx}"></div><input class="number" type="number" min="${min}" max="${max}" step="${step}" data-model="${model}" data-index="${idx}">`;
          channels.appendChild(row); this.modelEls[model].push({range:row.querySelector('input[type=range]'),number:row.querySelector('.number'),wrap:row.querySelector('.slider-wrap')});
        });
        this.root.appendChild(card);
      }
    }
    setActiveModel(model){ document.querySelectorAll('.model-card').forEach(x=>x.classList.toggle('active',x.dataset.model===model)); }
    setValues(all,activeModel){
      for(const [model,values] of Object.entries(all)) values.forEach((v,i)=>{ if(model===activeModel && document.activeElement===this.modelEls[model][i].number)return; const txt=(model==='RGB'?Math.round(v):Number(v.toFixed(3))); this.modelEls[model][i].range.value=v; this.modelEls[model][i].number.value=txt; });
    }
    setPreview(rgb,hex){ document.documentElement.style.setProperty('--current-color',hex); document.getElementById('preview').style.background=hex; document.getElementById('hex').value=hex; document.getElementById('native-picker').value=hex.toLowerCase(); document.getElementById('rgb-label').textContent=`rgb(${rgb.map(v=>Math.round(v)).join(', ')})`; }
    setWarning(show,text=''){ const el=document.getElementById('warning'); el.hidden=!show; if(show) el.textContent=text; }
    setMatrix(info){
      document.getElementById('whitepoint').textContent=`Точка белого: Xn=${info.whiteXYZ[0].toFixed(4)}, Yn=${info.whiteXYZ[1].toFixed(4)}, Zn=${info.whiteXYZ[2].toFixed(4)}`;
    }
  }
  global.AppView={AppView,SPECS};
})(window);
