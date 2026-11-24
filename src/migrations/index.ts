import * as migration_20260112_063824 from './20260112_063824';
import * as migration_20260112_163613_split_email_sms_settings from './20260112_163613_split_email_sms_settings';
import * as migration_20260516_125650_add_maintenance_retention from './20260516_125650_add_maintenance_retention';
import * as migration_20260731_171745_add_api_key_strategy from './20260731_171745_add_api_key_strategy';
import * as migration_20260821_192600_add_localization_settings from './20260821_192600_add_localization_settings';
import * as migration_20261110_150700_add_lagebild from './20261110_150700_add_lagebild';
import * as migration_20261110_170500_add_users_reset_password_requested_at from './20261110_170500_add_users_reset_password_requested_at';
import * as migration_20261110_180000_add_lagebild_period_days from './20261110_180000_add_lagebild_period_days';
import * as migration_20261110_190000_add_group_icons from './20261110_190000_add_group_icons';
import * as migration_20261110_190100_set_group_icons from './20261110_190100_set_group_icons';
import * as migration_20261110_200000_add_lagebild_bar_hours from './20261110_200000_add_lagebild_bar_hours';
import * as migration_20261111_100000_add_subscriber_confirmation from './20261111_100000_add_subscriber_confirmation';
import * as migration_20261112_100000_add_availability_target_and_event_source from './20261112_100000_add_availability_target_and_event_source';
import * as migration_20261112_100100_backfill_status_events from './20261112_100100_backfill_status_events';
import * as migration_20261112_200000_add_incident_availability_class from './20261112_200000_add_incident_availability_class';
import * as migration_20261113_100000_add_report_recipients from './20261113_100000_add_report_recipients';
import * as migration_20261113_200000_add_status_box_settings from './20261113_200000_add_status_box_settings';
import * as migration_20261115_100000_add_settings_language from './20261115_100000_add_settings_language';
import * as migration_20261116_100000_drop_settings_language from './20261116_100000_drop_settings_language';
import * as migration_20261116_200000_sms_templates_follow_language from './20261116_200000_sms_templates_follow_language';
import * as migration_20261116_300000_add_report_mail_limit from './20261116_300000_add_report_mail_limit';
import * as migration_20261116_400000_approve_existing_sms_subscribers from './20261116_400000_approve_existing_sms_subscribers';
import * as migration_20261116_500000_add_classification_rules from './20261116_500000_add_classification_rules';
import * as migration_20261116_500100_seed_classification_rules from './20261116_500100_seed_classification_rules';
import * as migration_20261116_600000_add_message_templates from './20261116_600000_add_message_templates';
import * as migration_20261116_700000_seed_message_templates from './20261116_700000_seed_message_templates';
import * as migration_20261116_800000_add_notification_ntfy_body from './20261116_800000_add_notification_ntfy_body';
import * as migration_20261116_900000_add_incident_update_texts from './20261116_900000_add_incident_update_texts';
import * as migration_20261117_100000_add_is_test from './20261117_100000_add_is_test';
import * as migration_20261118_100000_add_service_lifecycle from './20261118_100000_add_service_lifecycle';
import * as migration_20261118_200000_add_report_display from './20261118_200000_add_report_display';
import * as migration_20261118_300000_add_maintenance_update_texts from './20261118_300000_add_maintenance_update_texts';
import * as migration_20261119_100000_add_maintenance_kind from './20261119_100000_add_maintenance_kind';
import * as migration_20261119_200000_add_maintenance_affects_service from './20261119_200000_add_maintenance_affects_service';
import * as migration_20261119_300000_add_notification_draft_flag from './20261119_300000_add_notification_draft_flag';
import * as migration_20261120_100000_add_status_before_incident from './20261120_100000_add_status_before_incident';
import * as migration_20261120_100100_add_incident_service_choices from './20261120_100100_add_incident_service_choices';
import * as migration_20261124_100000_remove_lagebild_variant_both from './20261124_100000_remove_lagebild_variant_both';
import * as migration_20261125_100000_users_roles from './20261125_100000_users_roles';

export const migrations = [
  {
    up: migration_20260112_063824.up,
    down: migration_20260112_063824.down,
    name: '20260112_063824',
  },
  {
    up: migration_20260112_163613_split_email_sms_settings.up,
    down: migration_20260112_163613_split_email_sms_settings.down,
    name: '20260112_163613_split_email_sms_settings',
  },
  {
    up: migration_20260516_125650_add_maintenance_retention.up,
    down: migration_20260516_125650_add_maintenance_retention.down,
    name: '20260516_125650_add_maintenance_retention',
  },
  {
    up: migration_20260731_171745_add_api_key_strategy.up,
    down: migration_20260731_171745_add_api_key_strategy.down,
    name: '20260731_171745_add_api_key_strategy',
  },
  {
    up: migration_20260821_192600_add_localization_settings.up,
    down: migration_20260821_192600_add_localization_settings.down,
    name: '20260821_192600_add_localization_settings',
  },
  {
    up: migration_20261110_150700_add_lagebild.up,
    down: migration_20261110_150700_add_lagebild.down,
    name: '20261110_150700_add_lagebild',
  },
  {
    up: migration_20261110_170500_add_users_reset_password_requested_at.up,
    down: migration_20261110_170500_add_users_reset_password_requested_at.down,
    name: '20261110_170500_add_users_reset_password_requested_at',
  },
  {
    up: migration_20261110_180000_add_lagebild_period_days.up,
    down: migration_20261110_180000_add_lagebild_period_days.down,
    name: '20261110_180000_add_lagebild_period_days',
  },
  {
    up: migration_20261110_190000_add_group_icons.up,
    down: migration_20261110_190000_add_group_icons.down,
    name: '20261110_190000_add_group_icons',
  },
  {
    up: migration_20261110_190100_set_group_icons.up,
    down: migration_20261110_190100_set_group_icons.down,
    name: '20261110_190100_set_group_icons',
  },
  {
    up: migration_20261110_200000_add_lagebild_bar_hours.up,
    down: migration_20261110_200000_add_lagebild_bar_hours.down,
    name: '20261110_200000_add_lagebild_bar_hours',
  },
  {
    up: migration_20261111_100000_add_subscriber_confirmation.up,
    down: migration_20261111_100000_add_subscriber_confirmation.down,
    name: '20261111_100000_add_subscriber_confirmation',
  },
  {
    up: migration_20261112_100000_add_availability_target_and_event_source.up,
    down: migration_20261112_100000_add_availability_target_and_event_source.down,
    name: '20261112_100000_add_availability_target_and_event_source',
  },
  {
    up: migration_20261112_100100_backfill_status_events.up,
    down: migration_20261112_100100_backfill_status_events.down,
    name: '20261112_100100_backfill_status_events',
  },
  {
    up: migration_20261112_200000_add_incident_availability_class.up,
    down: migration_20261112_200000_add_incident_availability_class.down,
    name: '20261112_200000_add_incident_availability_class',
  },
  {
    up: migration_20261113_100000_add_report_recipients.up,
    down: migration_20261113_100000_add_report_recipients.down,
    name: '20261113_100000_add_report_recipients',
  },
  {
    up: migration_20261113_200000_add_status_box_settings.up,
    down: migration_20261113_200000_add_status_box_settings.down,
    name: '20261113_200000_add_status_box_settings',
  },
  {
    up: migration_20261115_100000_add_settings_language.up,
    down: migration_20261115_100000_add_settings_language.down,
    name: '20261115_100000_add_settings_language',
  },
  {
    up: migration_20261116_100000_drop_settings_language.up,
    down: migration_20261116_100000_drop_settings_language.down,
    name: '20261116_100000_drop_settings_language',
  },
  {
    up: migration_20261116_200000_sms_templates_follow_language.up,
    down: migration_20261116_200000_sms_templates_follow_language.down,
    name: '20261116_200000_sms_templates_follow_language',
  },
  {
    up: migration_20261116_300000_add_report_mail_limit.up,
    down: migration_20261116_300000_add_report_mail_limit.down,
    name: '20261116_300000_add_report_mail_limit',
  },
  {
    up: migration_20261116_400000_approve_existing_sms_subscribers.up,
    down: migration_20261116_400000_approve_existing_sms_subscribers.down,
    name: '20261116_400000_approve_existing_sms_subscribers',
  },
  {
    up: migration_20261116_500000_add_classification_rules.up,
    down: migration_20261116_500000_add_classification_rules.down,
    name: '20261116_500000_add_classification_rules',
  },
  {
    up: migration_20261116_500100_seed_classification_rules.up,
    down: migration_20261116_500100_seed_classification_rules.down,
    name: '20261116_500100_seed_classification_rules',
  },
  {
    up: migration_20261116_600000_add_message_templates.up,
    down: migration_20261116_600000_add_message_templates.down,
    name: '20261116_600000_add_message_templates',
  },
  {
    up: migration_20261116_700000_seed_message_templates.up,
    down: migration_20261116_700000_seed_message_templates.down,
    name: '20261116_700000_seed_message_templates',
  },
  {
    up: migration_20261116_800000_add_notification_ntfy_body.up,
    down: migration_20261116_800000_add_notification_ntfy_body.down,
    name: '20261116_800000_add_notification_ntfy_body',
  },
  {
    up: migration_20261116_900000_add_incident_update_texts.up,
    down: migration_20261116_900000_add_incident_update_texts.down,
    name: '20261116_900000_add_incident_update_texts',
  },
  {
    up: migration_20261117_100000_add_is_test.up,
    down: migration_20261117_100000_add_is_test.down,
    name: '20261117_100000_add_is_test',
  },
  {
    up: migration_20261118_100000_add_service_lifecycle.up,
    down: migration_20261118_100000_add_service_lifecycle.down,
    name: '20261118_100000_add_service_lifecycle',
  },
  {
    up: migration_20261118_200000_add_report_display.up,
    down: migration_20261118_200000_add_report_display.down,
    name: '20261118_200000_add_report_display',
  },
  {
    up: migration_20261118_300000_add_maintenance_update_texts.up,
    down: migration_20261118_300000_add_maintenance_update_texts.down,
    name: '20261118_300000_add_maintenance_update_texts',
  },
  {
    up: migration_20261119_100000_add_maintenance_kind.up,
    down: migration_20261119_100000_add_maintenance_kind.down,
    name: '20261119_100000_add_maintenance_kind',
  },
  {
    up: migration_20261119_200000_add_maintenance_affects_service.up,
    down: migration_20261119_200000_add_maintenance_affects_service.down,
    name: '20261119_200000_add_maintenance_affects_service',
  },
  {
    up: migration_20261119_300000_add_notification_draft_flag.up,
    down: migration_20261119_300000_add_notification_draft_flag.down,
    name: '20261119_300000_add_notification_draft_flag',
  },
  {
    up: migration_20261120_100000_add_status_before_incident.up,
    down: migration_20261120_100000_add_status_before_incident.down,
    name: '20261120_100000_add_status_before_incident',
  },
  {
    up: migration_20261120_100100_add_incident_service_choices.up,
    down: migration_20261120_100100_add_incident_service_choices.down,
    name: '20261120_100100_add_incident_service_choices',
  },
  {
    up: migration_20261124_100000_remove_lagebild_variant_both.up,
    down: migration_20261124_100000_remove_lagebild_variant_both.down,
    name: '20261124_100000_remove_lagebild_variant_both',
  },
  {
    up: migration_20261125_100000_users_roles.up,
    down: migration_20261125_100000_users_roles.down,
    name: '20261125_100000_users_roles',
  },
];
