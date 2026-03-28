import './ListView.css';

export default function ListView({ items, onSelect }) {
  if (items.length === 0) {
    return (
      <div className="list-view">
        <div className="list-empty">No titles found</div>
      </div>
    );
  }

  return (
    <div className="list-view">
      {items.map(item => (
        <button key={item.id} className="list-row" onClick={() => onSelect(item)}>
          <span className="list-title">{item.title}</span>
          {item.year && <span className="list-year">{item.year}</span>}
        </button>
      ))}
    </div>
  );
}
