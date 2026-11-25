export default function PageIntro({eyebrow,title,description,aside}){
  return <div className="page-intro wrap"><div className="page-intro-main"><span className="eyebrow"><i aria-hidden="true"/>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{aside&&<div className="page-intro-aside">{aside}</div>}</div>;
}
