import { ServiceDeleteNotice as ServiceDeleteNotice_b44acf9599e0763461dd09edaba54553 } from '@/components/admin/ServiceDeleteNotice'
import { LocalizedDateField as LocalizedDateField_5565580924a7fcfc6f968cbe9a2ca4e8 } from '@/components/admin/LocalizedDateField'
import { ServiceStateFilter as ServiceStateFilter_bae5af94238f689413b74e3c586adc4b } from '@/components/admin/ServiceStateFilter'
import { UpdateTemplatePicker as UpdateTemplatePicker_85194b4d1de7c3379b0a892b4903ac11 } from '@/components/admin/update-template/UpdateTemplatePicker'
import { NewWithTemplateButton as NewWithTemplateButton_06d16fae53404081c552d973d02d1fdc } from '@/components/admin/incident-wizard/NewWithTemplateButton'
import { RscEntryLexicalCell as RscEntryLexicalCell_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { RscEntryLexicalField as RscEntryLexicalField_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { LexicalDiffComponent as LexicalDiffComponent_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { FixedToolbarFeatureClient as FixedToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { LinkFeatureClient as LinkFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { StrikethroughFeatureClient as StrikethroughFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { UnderlineFeatureClient as UnderlineFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { BoldFeatureClient as BoldFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { ItalicFeatureClient as ItalicFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { ParagraphFeatureClient as ParagraphFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { NewMaintenanceWithTemplateButton as NewMaintenanceWithTemplateButton_06d16fae53404081c552d973d02d1fdc } from '@/components/admin/incident-wizard/NewWithTemplateButton'
import { SendNotificationCollectionButton as SendNotificationCollectionButton_d01a4935353b96154d106bbf01b3d3d7 } from '@/components/admin/SendNotificationCollectionButton'
import { RecipientCountField as RecipientCountField_a92dd7a84f1ac5bf2f0c7a2ae42e7fcd } from '@/components/admin/RecipientCountField'
import { AvailabilityReportNavLink as AvailabilityReportNavLink_a4d90559fc0de3f416b799fd68d772c9 } from '@/components/admin/availability-report/AvailabilityReportNavLink'
import { StatusLogNavLink as StatusLogNavLink_aaf557aedce5b7e65dd708b4b56f4d66 } from '@/components/admin/status-log/StatusLogNavLink'
import { SystemNavLine as SystemNavLine_46c0d64f8848b895e6aede541fc021c5 } from '@/components/admin/SystemInfo'
import { DashboardWidgets as DashboardWidgets_55e8c9f1aba7d352d950aef48719be05 } from '@/components/admin/DashboardWidgets'
import { SystemCard as SystemCard_46c0d64f8848b895e6aede541fc021c5 } from '@/components/admin/SystemInfo'
import { AvailabilityReportView as AvailabilityReportView_5550af07d623cc41d27945af83527692 } from '@/components/admin/availability-report'
import { StatusLogAdminView as StatusLogAdminView_99d04bdba5865d3d3bff5f4a304dc81d } from '@/components/admin/status-log'
import { IncidentFromTemplateView as IncidentFromTemplateView_a925f0e00babbf0f132057dbed4787e5 } from '@/components/admin/incident-wizard'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'
import { VercelBlobClientUploadHandler as VercelBlobClientUploadHandler_16c82c5e25f430251a3e3ba57219ff4e } from '@payloadcms/storage-vercel-blob/client'

/** @type import('payload').ImportMap */
export const importMap = {
  "@/components/admin/ServiceDeleteNotice#ServiceDeleteNotice": ServiceDeleteNotice_b44acf9599e0763461dd09edaba54553,
  "@/components/admin/LocalizedDateField#LocalizedDateField": LocalizedDateField_5565580924a7fcfc6f968cbe9a2ca4e8,
  "@/components/admin/ServiceStateFilter#ServiceStateFilter": ServiceStateFilter_bae5af94238f689413b74e3c586adc4b,
  "@/components/admin/update-template/UpdateTemplatePicker#UpdateTemplatePicker": UpdateTemplatePicker_85194b4d1de7c3379b0a892b4903ac11,
  "@/components/admin/incident-wizard/NewWithTemplateButton#NewWithTemplateButton": NewWithTemplateButton_06d16fae53404081c552d973d02d1fdc,
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalCell": RscEntryLexicalCell_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalField": RscEntryLexicalField_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/rsc#LexicalDiffComponent": LexicalDiffComponent_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/client#FixedToolbarFeatureClient": FixedToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#LinkFeatureClient": LinkFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#StrikethroughFeatureClient": StrikethroughFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#UnderlineFeatureClient": UnderlineFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#BoldFeatureClient": BoldFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#ItalicFeatureClient": ItalicFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#ParagraphFeatureClient": ParagraphFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@/components/admin/incident-wizard/NewWithTemplateButton#NewMaintenanceWithTemplateButton": NewMaintenanceWithTemplateButton_06d16fae53404081c552d973d02d1fdc,
  "@/components/admin/SendNotificationCollectionButton#SendNotificationCollectionButton": SendNotificationCollectionButton_d01a4935353b96154d106bbf01b3d3d7,
  "@/components/admin/RecipientCountField#RecipientCountField": RecipientCountField_a92dd7a84f1ac5bf2f0c7a2ae42e7fcd,
  "@/components/admin/availability-report/AvailabilityReportNavLink#AvailabilityReportNavLink": AvailabilityReportNavLink_a4d90559fc0de3f416b799fd68d772c9,
  "@/components/admin/status-log/StatusLogNavLink#StatusLogNavLink": StatusLogNavLink_aaf557aedce5b7e65dd708b4b56f4d66,
  "@/components/admin/SystemInfo#SystemNavLine": SystemNavLine_46c0d64f8848b895e6aede541fc021c5,
  "@/components/admin/DashboardWidgets#DashboardWidgets": DashboardWidgets_55e8c9f1aba7d352d950aef48719be05,
  "@/components/admin/SystemInfo#SystemCard": SystemCard_46c0d64f8848b895e6aede541fc021c5,
  "@/components/admin/availability-report#AvailabilityReportView": AvailabilityReportView_5550af07d623cc41d27945af83527692,
  "@/components/admin/status-log#StatusLogAdminView": StatusLogAdminView_99d04bdba5865d3d3bff5f4a304dc81d,
  "@/components/admin/incident-wizard#IncidentFromTemplateView": IncidentFromTemplateView_a925f0e00babbf0f132057dbed4787e5,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1,
  "@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler": VercelBlobClientUploadHandler_16c82c5e25f430251a3e3ba57219ff4e
}
