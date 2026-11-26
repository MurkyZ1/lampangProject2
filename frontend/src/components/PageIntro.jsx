import Photo from './ui/Photo';

export default function PageIntro({ eyebrow, title, description, aside, image }) {
  return <header className={`page-intro ${image ? 'page-intro--photo' : ''}`}>
    {image && <Photo img={image} className="page-intro-bg" eager alt="" width={1600} />}
    <div className="wrap page-intro-inner">
      <div className="page-intro-main">
        {eyebrow && <span className="eyebrow"><i aria-hidden="true" />{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {aside && <div className="page-intro-aside">{aside}</div>}
    </div>
  </header>;
}
