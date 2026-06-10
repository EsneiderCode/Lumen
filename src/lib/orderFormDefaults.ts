export interface ProjectDefaultsSource {
  id: string
  client_id: string | null
  default_operator_id?: string | null
  default_line?: 'NE3' | 'NE4' | null
}

/**
 * Values to merge into the order form when the admin picks a project.
 * Only returns keys that the project can actually determine, so callers
 * never clobber a manually chosen value with undefined.
 */
export function deriveOrderDefaultsFromProject(project: ProjectDefaultsSource | undefined): {
  client_id?: string
  operator_id?: string
  line?: 'NE3' | 'NE4'
} {
  if (!project) return {}
  const out: { client_id?: string; operator_id?: string; line?: 'NE3' | 'NE4' } = {}
  if (project.client_id) out.client_id = project.client_id
  if (project.default_operator_id) out.operator_id = project.default_operator_id
  if (project.default_line) out.line = project.default_line
  return out
}
