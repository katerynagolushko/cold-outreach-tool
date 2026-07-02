import type { Lead } from "./db";

/**
 * Render a message template for a lead. Supported placeholders:
 * {{firstName}} {{lastName}} {{company}} {{role}} {{city}}
 */
export function renderTemplate(template: string, lead: Lead): string {
  return template
    .replace(/\{\{\s*firstName\s*\}\}/gi, lead.first_name)
    .replace(/\{\{\s*lastName\s*\}\}/gi, lead.last_name)
    .replace(/\{\{\s*company\s*\}\}/gi, lead.company)
    .replace(/\{\{\s*role\s*\}\}/gi, lead.role)
    .replace(/\{\{\s*city\s*\}\}/gi, lead.city);
}
