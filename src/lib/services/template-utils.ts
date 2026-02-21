/**
 * Shared template variable replacement utility
 */

export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value?.toString() ?? match;
  });
}
