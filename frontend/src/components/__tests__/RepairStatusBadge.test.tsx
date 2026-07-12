import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RepairStatusBadge, { statusColors, statusDotColors, RepairStatus } from '../RepairStatusBadge';

describe('RepairStatusBadge Component Tests', () => {
  const statuses: RepairStatus[] = ['pending', 'repairing', 'ready', 'delivered', 'cancelled'];

  statuses.forEach((status) => {
    it(`should render correct badge label and styles for status: ${status}`, () => {
      render(<RepairStatusBadge status={status} />);
      
      const badge = screen.getByTestId('status-badge');
      const dot = screen.getByTestId('status-badge-dot');

      // Assert label text is correct (case-insensitive checks)
      expect(screen.getByText(new RegExp(status, 'i'))).toBeInTheDocument();

      // Assert that custom Tailwind classes are applied correctly
      const expectedBadgeClasses = statusColors[status].split(' ');
      const expectedDotClass = statusDotColors[status];

      expectedBadgeClasses.forEach((cls) => {
        expect(badge.className).toContain(cls);
      });
      expect(dot.className).toContain(expectedDotClass);
    });
  });
});
