import {useCallback,useEffect,useRef,useState} from 'react';
import SiteHeader from './components/SiteHeader';
import Hero from './components/Hero';
import MapSection from './components/MapSection';
import ChatPopup from './components/ChatPopup';
import SoilPage from './pages/SoilPage';
import CropsPage from './pages/CropsPage';
import DashboardPage from './pages/DashboardPage';
import LimitationsPage from './pages/LimitationsPage';
import CommunityPage from './pages/CommunityPage';
import AuthPage from './pages/AuthPage';
import AdminPage from './pages/AdminPage';
import {communityRequest,storeToken,token} from './services/communityApi';
import useAgricultureData from './hooks/useAgricultureData';
import {DEMO_DISTRICTS} from './data/districts';
import {isDemoData,loadDistricts} from './services/districtService';
import {getChatReply} from './services/chatService';

const routes=new Set(['/','/soil','/crops','/dashboard','/limitations','/community','/auth','/admin']);
const currentPath=()=>routes.has(window.location.pathname)?window.location.pathname:'/';
function readStored(key,fallback){try{const value=window.localStorage.getItem(key);return value?JSON.parse(value):fallback;}catch{return fallback;}}

export default function App(){
  const [path,setPath]=useState(currentPath);
  const [cropToShow,setCropToShow]=useState(null);
  const [user,setUser]=useState(null);
  const [approvedReports,setApprovedReports]=useState([]);
  useEffect(()=>{if(path==='/')communityRequest('/community/posts').then(r=>setApprovedReports(r.posts||[])).catch(()=>setApprovedReports([]));},[path]);
  useEffect(()=>{if(token())communityRequest('/auth/me').then(data=>setUser(data.user)).catch(()=>setUser(null));},[]);
  const logout=async()=>{try{await communityRequest('/auth/logout','POST');}catch{}storeToken('');setUser(null);navigate('/');};
  const {tambons,stats,status,importFile}=useAgricultureData();
  const [districts,setDistricts]=useState(isDemoData?DEMO_DISTRICTS:[]);
  const [dataError,setDataError]=useState('');
  const [selected,setSelected]=useState(()=>readStored('lp_sel_react',null));
  const [history,setHistory]=useState(()=>{
    const data=readStored('lp_chat_react',[]);
    return Array.isArray(data)?data.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').map((m,i)=>({...m,id:m.id||`saved-${i}`})):[];
  });
  const [busy,setBusy]=useState(false);const [popupOpen,setPopupOpen]=useState(false);
  const busyRef=useRef(false);const historyRef=useRef(history);const serialRef=useRef(0);
  useEffect(()=>{const onPop=()=>{setPath(currentPath());window.scrollTo(0,0);};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
  useEffect(()=>{let mounted=true;loadDistricts().then(data=>{if(mounted){setDistricts(data);setDataError('');}}).catch(e=>{if(mounted)setDataError(e.message);});return()=>{mounted=false;};},[]);
  useEffect(()=>{if(selected)window.localStorage.setItem('lp_sel_react',JSON.stringify(selected));else window.localStorage.removeItem('lp_sel_react');},[selected]);
  useEffect(()=>{window.localStorage.setItem('lp_chat_react',JSON.stringify(history.slice(-30)));historyRef.current=history;},[history]);
  const navigate=useCallback((to,cropId)=>{
    if(!routes.has(to))return;
    if(to!==window.location.pathname)window.history.pushState({},'',to);
    if(cropId)setCropToShow(cropId);
    setPath(to);window.scrollTo({top:0,behavior:'instant'});
  },[]);
  const sendMessage=useCallback(async(text,districtOverride=null)=>{
    if(!text?.trim()||busyRef.current)return;
    busyRef.current=true;setBusy(true);
    const user={id:`u-${Date.now()}-${++serialRef.current}`,role:'user',content:text.trim()};
    const next=[...historyRef.current,user];historyRef.current=next;setHistory(next);
    try{
      const reply=await getChatReply({message:user.content,districtCode:districtOverride??selected,history:next.slice(-10).map(({role,content})=>({role,content})),districts});
      const complete=[...historyRef.current,{id:`a-${Date.now()}-${++serialRef.current}`,role:'assistant',content:reply}];historyRef.current=complete;setHistory(complete);
    }catch(error){
      const failed=[...historyRef.current,{id:`err-${Date.now()}-${++serialRef.current}`,role:'assistant',content:`ไม่สามารถเชื่อมต่อระบบตอบคำถามได้: ${error.message}\nกรุณาตรวจสอบ Backend หรือการตั้งค่า API`}];historyRef.current=failed;setHistory(failed);
    }finally{busyRef.current=false;setBusy(false);}
  },[selected,districts]);
  const askAboutDistrict=(d,t)=>{setSelected(d.code);setPopupOpen(true);sendMessage(t?`ตำบล${t.tambon} อำเภอ${d.th} มีข้อมูลสภาพดินและคำแนะนำการเพาะปลูกอย่างไร (กรุณาแยกข้อมูลที่ยืนยันแล้วออกจากข้อมูลทั่วไป)`: `ที่อำเภอ${d.th} ควรปลูกอะไรดี และต้องเตรียมดินอย่างไร`,d.code);};
  return <>
    <SiteHeader path={path} user={user} onLogout={logout} onNavigate={navigate} onOpenChat={()=>setPopupOpen(true)}/>
    <main id="main-content">
      {path==='/'&&<><Hero districts={districts} onOpenChat={()=>setPopupOpen(true)}/>{dataError&&<div className="wrap"><div className="data-error" role="alert">ไม่สามารถโหลดข้อมูลอำเภอ: {dataError}</div></div>}<MapSection districts={districts} selected={selected} onSelect={setSelected} onAsk={askAboutDistrict} tambons={tambons} reports={approvedReports} onCrop={cropId=>navigate('/crops',cropId)} onNavigate={navigate}/><section className="wrap home-more"><div><span className="panel-kicker">สำรวจข้อมูลเพิ่ม</span><h2>จากแผนที่ สู่การตัดสินใจปลูก</h2><p>เข้าไปดูข้อมูลตำบล วิเคราะห์คุณสมบัติดิน และเปรียบเทียบข้อมูลการเกษตร</p></div><div className="home-more-links"><button onClick={()=>navigate('/soil')}>วิเคราะห์ดิน ↗</button><button onClick={()=>navigate('/dashboard')}>Dashboard ↗</button></div></section></>}
      {path==='/soil'&&<SoilPage tambons={tambons} status={status} onNavigate={navigate} onOpenChat={()=>setPopupOpen(true)}/>}
      {path==='/crops'&&<CropsPage selectedCrop={cropToShow} onNavigate={navigate}/>}
      {path==='/dashboard'&&<DashboardPage tambons={tambons} stats={stats} status={status} onImport={importFile}/>}
      {path==='/limitations'&&<LimitationsPage tambons={tambons} stats={stats} status={status}/>}
      {path==='/community'&&<CommunityPage tambons={tambons} user={user} onNavigate={navigate}/>}
      {path==='/auth'&&<AuthPage onAuth={setUser} onNavigate={navigate}/>}
      {path==='/admin'&&<AdminPage user={user} onNavigate={navigate}/>}
    </main>
    <footer><div className="wrap foot"><div>ลำปาง · ปลูกดี — เครื่องมือวางแผนการปลูกเบื้องต้น</div><div>ข้อมูลตัวอย่าง/รายงานผู้ใช้ต้องตรวจสอบก่อนนำไปใช้งานจริง</div></div></footer>
    <ChatPopup open={popupOpen} onOpen={()=>setPopupOpen(true)} onClose={()=>setPopupOpen(false)} selected={selected} districts={districts} onSelect={setSelected} history={history} busy={busy} onSend={sendMessage}/>
  </>;
}
