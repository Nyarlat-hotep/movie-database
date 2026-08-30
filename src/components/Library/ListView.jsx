import { mediaTypeOf, facetLabel, facetColor } from '../../utils/mediaTypes.js';
import './ListView.css';

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
        const type = mediaTypeOf(item);
        // DVD is the default on nearly every film/TV row — badging it is noise.
        const facets = (item[type.facetField] || []).filter(f => f !== 'dvd').slice(0, 3);
        return (
          <button key={item.id} className="list-row" onClick={() => onSelect(item)}>
            <span className="list-title-group">
              {type.typeBadge && <span className="list-type-tag">{type.typeBadge}</span>}
              <span className="list-title">{item.title}</span>
              {facets.map(facet => (
                <span
                  key={facet}
                  className="list-format-tag"
                  style={{ '--tag-color': facetColor(facet) }}
                >
                  {facetLabel(facet)}
                </span>
              ))}
            </span>
            {item.year && <span className="list-year">{item.year}</span>}
          </button>
        );
      })}
    </div>
  );
}
