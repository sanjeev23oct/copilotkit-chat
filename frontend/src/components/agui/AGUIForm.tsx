import React, { useState } from 'react';
import type { AGUIForm as AGUIFormInterface, AGUIFormField } from '../../types/agui';

interface AGUIFormProps {
  element: AGUIFormInterface;
  onAction?: (actionId: string, params?: any) => void;
}

export const AGUIForm: React.FC<AGUIFormProps> = ({ element, onAction }) => {
  const { title, fields, submitText = 'Submit', onSubmit } = element.props;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field: AGUIFormField) => {
      if (field.required && (!formData[field.name] || formData[field.name] === '')) {
        newErrors[field.name] = `${field.label} is required`;
      }

      // Additional validation based on field type
      if (formData[field.name] && field.validation) {
        const value = formData[field.name];
        const validation = field.validation;

        if (validation.min && value.length < validation.min) {
          newErrors[field.name] = validation.message || `${field.label} must be at least ${validation.min} characters`;
        }

        if (validation.max && value.length > validation.max) {
          newErrors[field.name] = validation.message || `${field.label} must be no more than ${validation.max} characters`;
        }

        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
          newErrors[field.name] = validation.message || `${field.label} format is invalid`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      if (onSubmit && onAction) {
        onAction(onSubmit, formData);
      }
    }
  };

  const renderField = (field: AGUIFormField) => {
    const commonProps = {
      id: field.name,
      name: field.name,
      value: formData[field.name] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleInputChange(field.name, e.target.value),
      className: `mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:ring-1 px-3 py-2 ${
        errors[field.name] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
      }`,
      placeholder: field.placeholder,
      required: field.required
    };

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={3}
          />
        );

      case 'select':
        return (
          <select {...commonProps}>
            <option value="">Select {field.label}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <input
            type="checkbox"
            id={field.name}
            name={field.name}
            checked={formData[field.name] || false}
            onChange={(e) => handleInputChange(field.name, e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        );

      default:
        return (
          <input
            {...commonProps}
            type={field.type}
          />
        );
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {title}
        </h3>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field: AGUIFormField) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {field.type === 'checkbox' ? (
              <div className="mt-1">
                <div className="flex items-center">
                  {renderField(field)}
                  <label htmlFor={field.name} className="ml-2 text-sm text-gray-600">
                    {field.placeholder}
                  </label>
                </div>
              </div>
            ) : (
              renderField(field)
            )}
            
            {errors[field.name] && (
              <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
            )}
          </div>
        ))}

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            onClick={() => setFormData({})}
          >
            Reset
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {submitText}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AGUIForm;