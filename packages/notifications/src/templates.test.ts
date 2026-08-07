import { describe, expect, it } from 'vitest';
import { renderTemplate } from './templates.js';
describe('templates', () => { it('explica que el nivel base no cambia', () => expect(renderTemplate('SHORT_COVERAGE_ASSIGNED', { name:'Ana', targetLevel:8, baseLevel:7 }).text).toContain('nivel base permanece')); });
