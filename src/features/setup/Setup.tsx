import { useState } from 'react';
import type { PlayerSetup,Token } from '../../game/state/types';
import { Dialog } from '../../components/Dialog';
export const colors=['#cc6e50','#5f88b0','#82975d','#a780a5'];
export const tokens:Token[]=['◆','●','▲','✦'];
export const tokenNames=['Кристалл','Монета','Парус','Звезда'];
export function Setup({onStart,onClose}:{onStart:(players:PlayerSetup[])=>void;onClose:()=>void}){
  const [count,setCount]=useState(2);const [players,setPlayers]=useState<PlayerSetup[]>(colors.map((color,i)=>({name:['Яков','Лена','Саша','Маша'][i],color,token:tokens[i]})));
  const update=(index:number,change:Partial<PlayerSetup>)=>setPlayers(ps=>ps.map((p,i)=>i===index?{...p,...change}:p));
  return <Dialog title="Соберёмся за одним столом" onClose={onClose} wide><p className="muted">Выберите участников. Все играют по очереди на этом компьютере.</p><div className="segmented" aria-label="Количество игроков">{[2,3,4].map(n=><button key={n} className={count===n?'selected':''} onClick={()=>setCount(n)}>{n} игрока</button>)}</div><form onSubmit={e=>{e.preventDefault();onStart(players.slice(0,count));}}><div className="setup-players">{players.slice(0,count).map((p,i)=><fieldset key={i}><legend>Игрок {i+1}</legend><label>Имя<input aria-label={`Имя игрока ${i+1}`} value={p.name} onChange={e=>update(i,{name:e.target.value})} required maxLength={24}/></label><div className="setup-options"><label>Цвет<input type="color" aria-label={`Цвет игрока ${i+1}`} value={p.color} onChange={e=>update(i,{color:e.target.value})}/></label><label>Фишка<select aria-label={`Фишка игрока ${i+1}`} value={p.token} onChange={e=>update(i,{token:e.target.value as Token})}>{tokens.map((token,j)=><option key={token} value={token}>{token} {tokenNames[j]}</option>)}</select></label></div></fieldset>)}</div><div className="dialog-footer"><span className="muted">$1 500 каждому · классические правила</span><button className="primary" type="submit">Начать игру <span>↗</span></button></div></form></Dialog>;
}
