import {useEffect,useRef,useState} from 'react';
import { CircleAlert, CircleCheck, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck, UserRound, UserPlus } from 'lucide-react';
import Photo from '../components/ui/Photo';
import { useToast } from '../components/ui/Toast';
import { IMAGES } from '../data/images';
import {communityRequest,storeToken} from '../services/communityApi';
export default function AuthPage({onAuth,onNavigate}){
 const [mode,setMode]=useState('login'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [googleId,setGoogleId]=useState(null);const gBtn=useRef(null);const [showPw,setShowPw]=useState(false);const toast=useToast();
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
   if(mode==='register'){await communityRequest('/auth/register','POST',{name,email,password});setMode('login');setPassword('');setNotice('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');toast('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ','success');}
   else{const result=await communityRequest('/auth/login','POST',{email,password});storeToken(result.token);onAuth(result.user);toast(`ยินดีต้อนรับ ${result.user?.name||''}`.trim(),'success');onNavigate('/community');}
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 const switchMode=m=>{setMode(m);setError('');};
 return <section className="auth-page">
  <div className="auth-visual">
   <Photo img={IMAGES.paddy} className="auth-photo" eager width={1200}/>
   <div className="auth-visual-shade" aria-hidden="true"/>
   <div className="auth-visual-copy">
    <span className="eyebrow eyebrow--light"><i aria-hidden="true"/>บัญชีผู้ใช้</span>
    <h1>เข้าสู่ระบบ / สมัครสมาชิก</h1>
    <p>ต้องเข้าสู่ระบบก่อนส่งรายงานจากพื้นที่ โดยรายงานใหม่จะส่งให้ผู้ดูแลตรวจสอบก่อนเผยแพร่</p>
   </div>
  </div>
  <div className="auth-side">
   <div className="auth-panel fade-in">
    <div className="tabs auth-tabs" role="tablist" aria-label="เลือกการเข้าใช้งาน">
     <span className="tabs-ink" style={{left:5,width:'calc(50% - 5px)',transform:`translateX(${mode==='login'?'0':'100%'})`}} aria-hidden="true"/>
     <button type="button" role="tab" aria-selected={mode==='login'} onClick={()=>switchMode('login')}><LogIn aria-hidden="true"/>เข้าสู่ระบบ</button>
     <button type="button" role="tab" aria-selected={mode==='register'} onClick={()=>switchMode('register')}><UserPlus aria-hidden="true"/>สมัครสมาชิก</button>
    </div>
    <div className="auth-head" key={mode}><h2>{mode==='register'?'สร้างบัญชีใหม่':'ยินดีต้อนรับกลับมา'}</h2><p className="subtle">{mode==='register'?'บัญชีที่สมัครมีสิทธิ์ผู้ใช้ทั่วไป':'ใช้อีเมลหรือชื่อผู้ใช้ (id) ที่ลงทะเบียนไว้'}</p></div>
    <form onSubmit={submit} className="auth-fields" key={`form-${mode}`}>
     {mode==='register'&&<label className="field"><span>ชื่อที่แสดงต่อสาธารณะ</span><div className="input-icon"><UserRound aria-hidden="true"/><input minLength="2" maxLength="80" required value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></div><small className="field-error">กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร</small></label>}
     <label className="field"><span>{mode==='register'?'อีเมล':'อีเมลหรือชื่อผู้ใช้ (id)'}</span><div className="input-icon"><Mail aria-hidden="true"/><input type={mode==='register'?'email':'text'} required maxLength="150" autoComplete={mode==='register'?'email':'username'} value={email} onChange={e=>setEmail(e.target.value)}/></div><small className="field-error">{mode==='register'?'กรุณากรอกอีเมลให้ถูกต้อง':'กรุณากรอกอีเมลหรือชื่อผู้ใช้'}</small></label>
     <label className="field"><span>รหัสผ่าน {mode==='register'?'(อย่างน้อย 8 ตัวอักษร)':''}</span><div className="input-icon"><Lock aria-hidden="true"/><input type={showPw?'text':'password'} minLength={mode==='register'?8:1} maxLength="128" required autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="icon-btn icon-btn--sm input-action" onClick={()=>setShowPw(v=>!v)} aria-label={showPw?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'} aria-pressed={showPw}>{showPw?<EyeOff/>:<Eye/>}</button></div>
      {mode==='register'&&<div className="pw-meter" aria-hidden="true"><i className={password.length>=12?'is-3':password.length>=8?'is-2':password.length?'is-1':''}/></div>}
      <small className="field-error">{mode==='register'?'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร':'กรุณากรอกรหัสผ่าน'}</small></label>
     {error&&<p className="form-error" role="alert"><CircleAlert aria-hidden="true"/>{error}</p>}{notice&&<p className="form-success" role="status"><CircleCheck aria-hidden="true"/>{notice}</p>}
     <button className={`btn btn-g btn-lg ${busy?'is-loading':''}`} type="submit" disabled={busy}>{busy?'กำลังดำเนินการ…':mode==='register'?'สร้างบัญชี':'เข้าสู่ระบบ'}</button>
    </form>
    {googleId&&<div className="google-login"><p className="divider"><span>หรือ</span></p><div ref={gBtn}/></div>}
    <p className="auth-foot"><ShieldCheck aria-hidden="true"/>บัญชีทั่วไปไม่สามารถอนุมัติรายงานได้ สิทธิ์แอดมินตั้งค่าจาก Backend เท่านั้น</p>
   </div>
  </div>
 </section>;
}
