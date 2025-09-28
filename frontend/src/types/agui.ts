// Frontend AGUI Types (matching backend)

export interface AGUIElement {
  type: 'button' | 'form' | 'table' | 'card' | 'list' | 'chart' | 'text' | 'input';
  id: string;
  props: Record<string, any>;
  children?: AGUIElement[];
}

export interface AGUIButton extends AGUIElement {
  type: 'button';
  props: {
    text: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    onClick?: string;
  };
}

export interface AGUITable extends AGUIElement {
  type: 'table';
  props: {
    headers: string[];
    rows: any[][];
    sortable?: boolean;
    filterable?: boolean;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
}

export interface AGUIForm extends AGUIElement {
  type: 'form';
  props: {
    title?: string;
    fields: AGUIFormField[];
    submitText?: string;
    onSubmit?: string;
  };
}

export interface AGUIFormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface AGUICard extends AGUIElement {
  type: 'card';
  props: {
    title?: string;
    subtitle?: string;
    content: string;
    actions?: AGUIButton[];
    variant?: 'default' | 'outlined' | 'elevated';
  };
}

export interface AGUIChart extends AGUIElement {
  type: 'chart';
  props: {
    chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
    data: {
      labels: string[];
      datasets: {
        label: string;
        data: number[];
        backgroundColor?: string[];
        borderColor?: string[];
      }[];
    };
    options?: Record<string, any>;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agui?: AGUIElement[];
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamChunk {
  type: 'text' | 'agui' | 'error' | 'done';
  content?: string;
  agui?: AGUIElement;
  error?: string;
  metadata?: Record<string, any>;
}