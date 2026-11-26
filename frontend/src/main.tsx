import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles.css';
import { installInlineFormValidation } from './shared/ui/inline-form-validation';

installInlineFormValidation();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
