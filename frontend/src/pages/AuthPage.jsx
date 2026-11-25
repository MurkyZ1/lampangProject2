import {useEffect,useRef,useState} from 'react';
import PageIntro from '../components/PageIntro';
import {communityRequest,storeToken} from '../services/communityApi';
export default function AuthPage({onAuth,onNavigate}){
 const [mode,setMode]=useState('login'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [googleId,setGoogleId]=useState(null);const gBtn=useRef(null);
 useEffect(()=>{communityRequest('/auth/config').then(c=>setGoogleId(c.googleClientId||null)).catch(()=>setGoogleId(null));},[]);
 useEffect(()=>{
   if(!googleId||!gBtn.current)return;let dead=false;
   const init=()=>{if(dead||!window.google?.accounts?.id)return;
     window.google.accounts.id.initialize({client_id:googleId,callback:async({credential})=>{setError('');setBusy(true);try{const r=await communityRequest('/auth/google','POST',{credential});storeToken(r.token);onAuth(r.user);onNavigate('/community');}catch(e){setError(e.message);}finally{setBusy(false);}}});
     window.google.accounts.id.renderButton(gBtn.current,{theme:'outline',size:'large',text:'signin_with',locale:'th',width:320});};
   if(window.google?.accounts?.id)init();
   else{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=init;document.head.appendChild(s);}
   return()=>{dead=true;};
 },[googleId,mode]);
 async function submit(e){e.preventDefault();setError('');setNotice('');setBusy(true);try{
   if(mode==='register'){await communityRequest('/auth/register','POST',{name,email,password});setMode('login');setPassword('');setNotice('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');}
   else{const result=await communityRequest('/auth/login','POST',{email,password});storeToken(result.token);onAuth(result.user);onNavigate('/community');}
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 return <><PageIntro eyebrow="บัญชีผู้ใช้" title="เข้าสู่ระบบ / สมัครสมาชิก" description="ต้องเข้าสู่ระบบก่อนส่งรายงานจากพื้นที่ โดยรายงานใหม่จะส่งให้ผู้ดูแลตรวจสอบก่อนเผยแพร่"/><section className="wrap page-content"><div className="panel auth-panel"><div className="filter-pills"><button className={`filter-pill ${mode==='login'?'selected':''}`} onClick={()=>{setMode('login');setError('');}}>เข้าสู่ระบบ</button><button className={`filter-pill ${mode==='register'?'selected':''}`} onClick={()=>{setMode('register');setError('');}}>สมัครสมาชิก</button></div><form onSubmit={submit} className="auth-fields">{mode==='register'&&<label className="field"><span>ชื่อที่แสดงต่อสาธารณะ</span><input minLength="2" maxLength="80" required value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>}<label className="field"><span>{mode==='register'?'อีเมล':'อีเมลหรือชื่อผู้ใช้ (id)'}</span><input type={mode==='register'?'email':'text'} required maxLength="150" autoComplete={mode==='register'?'email':'username'} value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field"><span>รหัสผ่าน {mode==='register'?'(อย่างน้อย 8 ตัวอักษร)':''}</span><input type="password" minLength={mode==='register'?8:1} maxLength="128" required autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-success" role="status">{notice}</p>}<button className="btn btn-g" type="submit" disabled={busy}>{busy?'กำลังดำเนินการ…':mode==='register'?'สร้างบัญชี':'เข้าสู่ระบบ'}</button></form>{googleId&&<div className="google-login"><p className="subtle">หรือ</p><div ref={gBtn}/></div>}<p className="subtle">บัญชีทั่วไปไม่สามารถอนุมัติรายงานได้ สิทธิ์แอดมินตั้งค่าจาก Backend เท่านั้น</p></div></section></>;
}
