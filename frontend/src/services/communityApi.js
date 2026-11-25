const base=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
const storageKey='lp_session_token';
export const token=()=>{try{return sessionStorage.getItem(storageKey)||'';}catch{return '';}};
export const storeToken=t=>{try{if(t)sessionStorage.setItem(storageKey,t);else sessionStorage.removeItem(storageKey);}catch{/* browser disabled */}};
export async function communityRequest(path,method='GET',body){
 let res;
 try{res=await fetch(`${base}/api${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token()?{Authorization:`Bearer ${token()}`}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw new Error('เชื่อมต่อ Backend ไม่ได้ กรุณารัน backend (uvicorn main:app --port 8000)');}
 const data=await res.json().catch(()=>({}));
 if(!res.ok){if(res.status===401&&path!=='/auth/login'&&path!=='/auth/register')storeToken('');throw new Error(data.error||`API ตอบกลับ ${res.status}`);}
 return data;
}
