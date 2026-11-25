import {useCallback,useEffect,useState} from 'react';
import {loadAgricultureDataset,readDatasetFile} from '../services/agriDataService';
export default function useAgricultureData(){
  const [tambons,setTambons]=useState([]);
  const [stats,setStats]=useState([]);
  const [status,setStatus]=useState({tambons:'กำลังอ่านไฟล์ข้อมูล…',stats:'กำลังอ่านไฟล์ข้อมูล…'});
  const [errors,setErrors]=useState({tambons:'',stats:''});
  useEffect(()=>{
    let alive=true;
    for(const kind of ['tambons','stats']){
      loadAgricultureDataset(kind).then(rows=>{
        if(!alive)return;
        (kind==='tambons'?setTambons:setStats)(rows);
        setStatus(s=>({...s,[kind]:rows.length?'ข้อมูลจากไฟล์หรือ API':'ยังไม่ได้เชื่อมข้อมูลจริง'}));
      }).catch(e=>{
        if(!alive)return;
        setStatus(s=>({...s,[kind]:'ยังไม่ได้เชื่อมข้อมูลจริง'}));
        setErrors(s=>({...s,[kind]:e.message}));
      });
    }
    return()=>{alive=false;};
  },[]);
  const importFile=useCallback(async(kind,file)=>{
    const {rows,invalid}=await readDatasetFile(file,kind);
    (kind==='tambons'?setTambons:setStats)(rows);
    setStatus(s=>({...s,[kind]:`นำเข้าจาก ${file.name} (เฉพาะหน้านี้)`}));
    setErrors(s=>({...s,[kind]:''}));
    return {count:rows.length,invalid};
  },[]);
  return {tambons,stats,status,errors,importFile};
}
