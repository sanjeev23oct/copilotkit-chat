import React from 'react';
import type { AGUIElement } from '../../types/agui';
import { AGUIButton } from './AGUIButton';
import { AGUITable } from './AGUITable';
import { AGUICard } from './AGUICard';
import { AGUIChart } from './AGUIChart';

interface AGUIRendererProps {
  elements: AGUIElement[];
  onAction?: (actionId: string, params?: any) => void;
}

export const AGUIRenderer: React.FC<AGUIRendererProps> = ({ elements, onAction }) => {
  const renderElement = (element: AGUIElement): React.ReactNode => {
    switch (element.type) {
      case 'button':
        return (
          <AGUIButton
            key={element.id}
            element={element as any}
            onAction={onAction}
          />
        );
        
      case 'table':
        return (
          <AGUITable
            key={element.id}
            element={element as any}
          />
        );
        
      case 'card':
        return (
          <AGUICard
            key={element.id}
            element={element as any}
            onAction={onAction}
          />
        );
        
      case 'chart':
        return (
          <AGUIChart
            key={element.id}
            element={element as any}
          />
        );
        
      case 'text':
        return (
          <div key={element.id} className="text-gray-700">
            {element.props.content}
          </div>
        );
        
      default:
        console.warn(`Unknown AGUI element type: ${element.type}`);
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {elements.map(element => (
        <div key={element.id}>
          {renderElement(element)}
          {element.children && element.children.length > 0 && (
            <div className="mt-2 ml-4">
              <AGUIRenderer elements={element.children} onAction={onAction} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AGUIRenderer;