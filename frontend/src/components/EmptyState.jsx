export default function EmptyState({icon='◌',title,description}){
  return <div className="empty-state"><div className="empty-icon" aria-hidden="true">{icon}</div><h3>{title}</h3><p>{description}</p></div>;
}
