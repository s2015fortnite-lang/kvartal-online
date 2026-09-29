import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import App from '../src/app/App';
it('opens the local game', () => { render(<App />); expect(screen.getByRole('heading', { name: 'Квартал' })).toBeInTheDocument(); });
