import './ListView.css';

const FORMAT_TAGS = [
  { key: 'bluray', label: 'BR' },
  { key: 'vhs',    label: 'VHS' },
];

export default function ListView({ items, onSelect }) {
  if (items.length === 0) {
    return (
      <div className="list-view">
        <div className="list-count">0 titles</div>
        <div className="list-empty">No titles found</div>
      </div>
    );
  }

  return (
    <div className="list-view">
      <div className="list-count">{items.length} title{items.length !== 1 ? 's' : ''}</div>
      {items.map(item => {
        const tags = FORMAT_TAGS.filter(f => (item.formats || []).includes(f.key));
        return (
          <button key={item.id} className="list-row" onClick={() => onSelect(item)}>
            <span className="list-title-group">
              <span className="list-title">{item.title}</span>
              {tags.map(f => (
                <span key={f.key} className={`list-format-tag list-format-tag--${f.key}`}>{f.label}</span>
              ))}
            </span>
            {item.year && <span className="list-year">{item.year}</span>}
          </button>
        );
      })}
    </div>
  );
}
