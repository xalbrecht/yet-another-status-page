const localizedDateField = '@/components/admin/LocalizedDateField#LocalizedDateField'

export function localizedDateAdmin(options?: {
  description?: string
  position?: 'sidebar'
  readOnly?: boolean
  hidden?: boolean
  pickerAppearance?: 'dayAndTime' | 'dayOnly'
  condition?: (data: unknown, siblingData: unknown) => boolean
}) {
  const { pickerAppearance = 'dayAndTime', ...rest } = options ?? {}
  return {
    ...rest,
    date: {
      pickerAppearance,
    },
    components: {
      Field: localizedDateField,
    },
  }
}
