// AGUI (Agentic UI) Types and Interfaces

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
    onClick?: string; // Action ID to execute
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
    onSubmit?: string; // Action ID to execute
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

export interface AGUIList extends AGUIElement {
  type: 'list';
  props: {
    items: AGUIListItem[];
    variant?: 'default' | 'numbered' | 'bulleted';
  };
}

export interface AGUIListItem {
  id: string;
  content: string;
  subtitle?: string;
  actions?: AGUIButton[];
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

// Chat Message with AGUI support
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

// Streaming response types
export interface StreamChunk {
  type: 'text' | 'agui' | 'error' | 'done';
  content?: string;
  agui?: AGUIElement;
  error?: string;
  metadata?: Record<string, any>;
}

// Action execution types
export interface AGUIAction {
  id: string;
  name: string;
  description: string;
  parameters: AGUIActionParameter[];
  handler: (params: Record<string, any>) => Promise<AGUIActionResult>;
}

export interface AGUIActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: any;
}

export interface AGUIActionResult {
  success: boolean;
  data?: any;
  message?: string;
  agui?: AGUIElement[];
  error?: string;
}

// Conversation types
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}