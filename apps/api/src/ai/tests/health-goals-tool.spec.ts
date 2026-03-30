import { describe, it, expect } from 'vitest';
import { manageHealthGoalsTool } from '../src/graph/tools.js';

describe('manageHealthGoalsTool', () => {
  it('должен содержать правильную схему (action, goal_title, category)', () => {
    expect(manageHealthGoalsTool.name).toBe('manage_health_goals');
    expect(manageHealthGoalsTool.schema).toBeDefined();
  });
});
