import React from 'react';
import type { AGUICard as AGUICardInterface } from '../../types/agui';
import { AGUIButton } from './AGUIButton';

interface AGUICardProps {
  element: AGUICardInterface;
  onAction?: (actionId: string, params?: any) => void;
}

export const AGUICard: React.FC<AGUICardProps> = ({ element, onAction }) => {
  const { title, subtitle, content, actions, variant = 'default' } = element.props;
  
  const variantClasses = {
    default: 'bg-white border border-gray-200',
    outlined: 'bg-white border-2 border-gray-300',
    elevated: 'bg-white shadow-lg border border-gray-100'
  };
  
  return (
    <div className={`rounded-lg p-6 ${variantClasses[variant]}`}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
      )}
      
      {subtitle && (
        <p className="text-sm text-gray-600 mb-3">
          {subtitle}
        </p>
      )}
      
      <div className="text-gray-700 mb-4">
        {content}
      </div>
      
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <AGUIButton
              key={index}
              element={action}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AGUICard;