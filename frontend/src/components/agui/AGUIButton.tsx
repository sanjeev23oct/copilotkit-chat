import React from 'react';
import type { AGUIButton as AGUIButtonInterface } from '../../types/agui';

interface AGUIButtonProps {
  element: AGUIButtonInterface;
  onAction?: (actionId: string, params?: any) => void;
}

export const AGUIButton: React.FC<AGUIButtonProps> = ({ element, onAction }) => {
  const { text, variant = 'primary', size = 'md', disabled = false, onClick } = element.props;
  
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus-visible:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500'
  };
  
  const sizeClasses = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base'
  };
  
  const handleClick = () => {
    if (onClick && onAction) {
      onAction(onClick);
    }
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      disabled={disabled}
      onClick={handleClick}
    >
      {text}
    </button>
  );
};

export default AGUIButton;