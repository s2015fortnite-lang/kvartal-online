import { useEffect,useRef,type ReactNode } from 'react';
export function Dialog({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current;if(!d)return;d.showModal();return()=>d.close();},[]);
  return <dialog ref={ref} className={wide?'dialog wide':'dialog'} onCancel={onClose} aria-label={title} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="dialog-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Закрыть">×</button></div>{children}</dialog>;
}
