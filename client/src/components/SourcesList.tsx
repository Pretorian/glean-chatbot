import type { RetrievedDoc } from '../types';
import './SourcesList.css';

interface SourcesListProps {
  sources: RetrievedDoc[];
}

function SourcesList({ sources }: SourcesListProps) {
  return (
    <div className="sources-list">
      <div className="sources-header">Sources:</div>
      <div className="sources-items">
        {sources.map((source, index) => (
          <div key={source.documentId} className="source-item">
            <div className="source-number">{index + 1}</div>
            <div className="source-content">
              <div className="source-title">
                {source.url && source.url.startsWith('http') ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link"
                  >
                    {source.title}
                  </a>
                ) : (
                  <span>{source.title}</span>
                )}
              </div>
              {source.snippet && (
                <div className="source-snippet">{source.snippet}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SourcesList;
